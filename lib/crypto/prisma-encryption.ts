// Prisma Client Extension による透過的フィールド暗号化（P1）。
//
// 書き込み（create/update/upsert/createMany 系）では対象フィールドを keyring で
// 暗号化してから DB に渡し、読み取り結果では対象フィールドを復号して返す。
// アプリのクエリ層・アクション層は暗号化を意識しない（透過）。
//
// 契約（フェイルクローズ）:
// - sealed 中に対象フィールドを書き込み/読み取りすると keyring が KeyringSealedError を
//   throw し、当該クエリは失敗する（PII を平文で読み書きさせない）。呼び出し側ページは
//   これを捕捉して「🔒 ロック中」を表示する。
// - 値が null/undefined はそのまま（暗号化しない）。
// - 既存の `v1:` 接頭辞付き値は二重暗号化しない（移行ウィンドウ対応）。
// - 読み取り時、接頭辞が無い値は平文とみなしそのまま返す（バックフィル前の互換）。
//
// 重要: keyring は node ランタイム専用。middleware/edge から import しないこと。

import * as keyring from "./keyring"

/** 暗号化対象の {モデル名: フィールド名[]} レジストリ。 */
export const ENCRYPTED_FIELDS: Record<string, readonly string[]> = {
  DutyAssignment: ["note", "title"],
  DutyType: ["defaultNote", "defaultTitle"],
}

const CIPHER_PREFIX = "v1:"

// 暗号化モデルへ到達するリレーション（親モデル → { リレーションフィールド名: 子モデル名 }）。
// 復号はクエリの「操作モデル」を起点に、ここに登録されたリレーションだけを辿る。
// これにより、暗号化対象でない同名列（例: ShiftChangeHistory.note は平文）を
// 別モデルの結果として誤って keyring.decrypt() に渡すことを防ぐ（モデル限定の復号）。
// 新しい include 経路で暗号化列を読む場合はここに追記する。漏れた場合の症状は
// 「UI に v1: 暗号文がそのまま出る」= ラウンドトリップ/エクスポートのテストで顕在化する
// （平文の静かな破損ではない）ため、フェイルセーフに倒れる。
const RELATIONS: Record<string, Readonly<Record<string, string>>> = {
  Employee: { dutyAssignments: "DutyAssignment" },
  DutyAssignment: { dutyType: "DutyType" },
  DutyType: { dutyAssignments: "DutyAssignment" },
}

function isCiphertext(v: unknown): v is string {
  return typeof v === "string" && v.startsWith(CIPHER_PREFIX)
}

/** 単一の書き込み値を暗号化。スカラ文字列と Prisma の `{ set: string }` 形式に対応。 */
function encryptValue(v: unknown): unknown {
  if (v == null) return v
  if (typeof v === "string") return isCiphertext(v) ? v : keyring.encrypt(v)
  if (typeof v === "object" && typeof (v as { set?: unknown }).set === "string") {
    const set = (v as { set: string }).set
    return { ...(v as object), set: isCiphertext(set) ? set : keyring.encrypt(set) }
  }
  return v
}

/**
 * 書き込み payload（data オブジェクト or 配列）の対象フィールドを暗号化した新オブジェクトを返す。
 *
 * 注: 暗号化は「操作モデル」基準。暗号化列を持つモデルは必ず自身の top-level 操作
 * （prisma.dutyAssignment.create 等）で書き込むこと。親モデル経由のネスト書き込み
 * （例: employee.update({ data: { dutyAssignments: { create: { note } } } })）は
 * 対象外で平文書き込みになる。現状そのような経路は無いが、追加時はここを拡張すること。
 */
function encryptWriteData(model: string, data: unknown): unknown {
  const fields = ENCRYPTED_FIELDS[model]
  if (!fields || data == null || typeof data !== "object") return data
  if (Array.isArray(data)) return data.map((d) => encryptWriteData(model, d))
  const out: Record<string, unknown> = { ...(data as Record<string, unknown>) }
  for (const f of fields) {
    if (f in out) out[f] = encryptValue(out[f])
  }
  return out
}

/**
 * 読み取り結果を「操作モデル」起点で復号する（in place）。
 * 各ノードでは当該モデルの暗号化フィールドのみ復号し、RELATIONS に登録された
 * リレーションだけを子モデルとして辿る。findMany は配列、create/update は単一行を渡す。
 */
function decryptNode(node: unknown, model: string): void {
  if (node == null || typeof node !== "object") return
  if (node instanceof Date || Buffer.isBuffer(node)) return
  if (Array.isArray(node)) {
    for (const item of node) decryptNode(item, model)
    return
  }
  const obj = node as Record<string, unknown>
  const fields = ENCRYPTED_FIELDS[model]
  if (fields) {
    for (const f of fields) {
      const v = obj[f]
      if (isCiphertext(v)) obj[f] = keyring.decrypt(v)
    }
  }
  const rels = RELATIONS[model]
  if (rels) {
    for (const rel of Object.keys(rels)) {
      if (obj[rel] != null) decryptNode(obj[rel], rels[rel])
    }
  }
}

/**
 * Prisma クライアントに透過暗号化拡張を適用する。
 * 本番シングルトン（lib/prisma.ts）とテスト（tests/helpers/prisma.ts）の両方に適用し、
 * 挙動を一致させる。
 *
 * query 拡張のみを使うためモデル API の型は変わらない。よって入力クライアントと
 * 同一の型 `T` を返す（戻り値で全モデル操作の型が保たれる）。
 */
export function withEncryption<T>(client: T): T {
  return (client as { $extends: (ext: unknown) => unknown }).$extends({
    name: "field-encryption",
    query: {
      $allModels: {
        async $allOperations({
          model,
          operation,
          args,
          query,
        }: {
          model: string
          operation: string
          args: Record<string, unknown>
          query: (args: Record<string, unknown>) => Promise<unknown>
        }) {
          if (model && ENCRYPTED_FIELDS[model]) {
            switch (operation) {
              case "create":
              case "update":
              case "updateMany":
              case "updateManyAndReturn":
                if (args.data != null) args.data = encryptWriteData(model, args.data)
                break
              case "createMany":
              case "createManyAndReturn":
                if (args.data != null) args.data = encryptWriteData(model, args.data)
                break
              case "upsert":
                if (args.create != null) args.create = encryptWriteData(model, args.create)
                if (args.update != null) args.update = encryptWriteData(model, args.update)
                break
            }
          }
          const result = await query(args)
          // 復号は操作モデル起点（model が無い $queryRaw 等は対象外）。
          if (model) decryptNode(result, model)
          return result
        },
      },
    },
  }) as T
}

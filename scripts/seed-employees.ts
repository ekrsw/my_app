import { prisma } from "../lib/prisma";

// 日本の姓
const lastNames = [
  "佐藤", "鈴木", "高橋", "田中", "伊藤", "渡辺", "山本", "中村", "小林", "加藤",
  "吉田", "山田", "佐々木", "山口", "松本", "井上", "木村", "林", "斎藤", "清水",
  "山崎", "阿部", "森", "池田", "橋本", "石川", "山下", "中島", "前田", "藤田",
  "小川", "岡田", "後藤", "長谷川", "村上", "近藤", "石井", "坂本", "遠藤", "藤井",
  "青木", "西村", "福田", "太田", "三浦", "岡本", "松田", "中野", "原田", "小野",
];

// 日本の名前（男性）
const maleFirstNames = [
  "太郎", "一郎", "健一", "直樹", "翔太", "大輔", "和也", "隆", "誠", "剛",
  "浩二", "雄太", "拓也", "達也", "正樹", "将", "裕介", "康太", "慎一", "智也",
  "亮", "悠太", "光一", "俊介", "大樹", "健太", "龍一", "修一", "秀樹", "陽介",
];

// 日本の名前（女性）
const femaleFirstNames = [
  "美咲", "愛", "さくら", "花子", "陽子", "恵子", "美香", "優子", "真由美", "直美",
  "由美", "麻衣", "彩", "奈々", "千尋", "明日香", "裕子", "久美子", "智子", "香織",
  "美穂", "絵美", "千代子", "幸子", "和子", "典子", "紀子", "敦子", "雅子", "清美",
];

// カタカナ変換用マップ（簡易版）
function toKatakana(name: string): string {
  const map: Record<string, string> = {
    佐藤: "サトウ", 鈴木: "スズキ", 高橋: "タカハシ", 田中: "タナカ", 伊藤: "イトウ",
    渡辺: "ワタナベ", 山本: "ヤマモト", 中村: "ナカムラ", 小林: "コバヤシ", 加藤: "カトウ",
    吉田: "ヨシダ", 山田: "ヤマダ", 佐々木: "ササキ", 山口: "ヤマグチ", 松本: "マツモト",
    井上: "イノウエ", 木村: "キムラ", 林: "ハヤシ", 斎藤: "サイトウ", 清水: "シミズ",
    山崎: "ヤマザキ", 阿部: "アベ", 森: "モリ", 池田: "イケダ", 橋本: "ハシモト",
    石川: "イシカワ", 山下: "ヤマシタ", 中島: "ナカジマ", 前田: "マエダ", 藤田: "フジタ",
    小川: "オガワ", 岡田: "オカダ", 後藤: "ゴトウ", 長谷川: "ハセガワ", 村上: "ムラカミ",
    近藤: "コンドウ", 石井: "イシイ", 坂本: "サカモト", 遠藤: "エンドウ", 藤井: "フジイ",
    青木: "アオキ", 西村: "ニシムラ", 福田: "フクダ", 太田: "オオタ", 三浦: "ミウラ",
    岡本: "オカモト", 松田: "マツダ", 中野: "ナカノ", 原田: "ハラダ", 小野: "オノ",
    太郎: "タロウ", 一郎: "イチロウ", 健一: "ケンイチ", 直樹: "ナオキ", 翔太: "ショウタ",
    大輔: "ダイスケ", 和也: "カズヤ", 隆: "タカシ", 誠: "マコト", 剛: "ツヨシ",
    浩二: "コウジ", 雄太: "ユウタ", 拓也: "タクヤ", 達也: "タツヤ", 正樹: "マサキ",
    将: "ショウ", 裕介: "ユウスケ", 康太: "コウタ", 慎一: "シンイチ", 智也: "トモヤ",
    亮: "リョウ", 悠太: "ユウタ", 光一: "コウイチ", 俊介: "シュンスケ", 大樹: "ダイキ",
    健太: "ケンタ", 龍一: "リュウイチ", 修一: "シュウイチ", 秀樹: "ヒデキ", 陽介: "ヨウスケ",
    美咲: "ミサキ", 愛: "アイ", さくら: "サクラ", 花子: "ハナコ", 陽子: "ヨウコ",
    恵子: "ケイコ", 美香: "ミカ", 優子: "ユウコ", 真由美: "マユミ", 直美: "ナオミ",
    由美: "ユミ", 麻衣: "マイ", 彩: "アヤ", 奈々: "ナナ", 千尋: "チヒロ",
    明日香: "アスカ", 裕子: "ユウコ", 久美子: "クミコ", 智子: "トモコ", 香織: "カオリ",
    美穂: "ミホ", 絵美: "エミ", 千代子: "チヨコ", 幸子: "サチコ", 和子: "カズコ",
    典子: "ノリコ", 紀子: "ノリコ", 敦子: "アツコ", 雅子: "マサコ", 清美: "キヨミ",
  };
  return map[name] || name;
}

// ランダムな日付を生成
function randomDate(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

// ランダムな要素を取得
function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// 複数のランダムな要素を取得（重複なし）
function randomChoices<T>(arr: T[], count: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, arr.length));
}

async function main() {
  console.log("=== 既存データを確認中 ===\n");

  // 既存のマスターデータを取得
  const groups = await prisma.group.findMany({ orderBy: { id: "asc" } });
  const positions = await prisma.position.findMany({ orderBy: { id: "asc" } });
  const functionRoles = await prisma.functionRole.findMany({ orderBy: { id: "asc" } });

  console.log(`グループ: ${groups.length}件`);
  console.log(`ポジション: ${positions.length}件`);
  console.log(`職掌: ${functionRoles.length}件`);

  if (groups.length === 0 || positions.length === 0 || functionRoles.length === 0) {
    console.error("マスターデータが不足しています。先にマスターデータを作成してください。");
    await prisma.$disconnect();
    process.exit(1);
  }

  // 100人の従業員を作成
  console.log("\n=== 従業員を作成中 ===\n");

  const employees = [];
  const today = new Date();

  for (let i = 0; i < 100; i++) {
    const isFemale = Math.random() > 0.6;
    const lastName = randomChoice(lastNames);
    const firstName = randomChoice(isFemale ? femaleFirstNames : maleFirstNames);
    const name = `${lastName} ${firstName}`;
    const nameKana = `${toKatakana(lastName)} ${toKatakana(firstName)}`;

    // 入社日を過去5年以内でランダムに設定
    const hireDate = randomDate(
      new Date(today.getFullYear() - 5, 0, 1),
      new Date(today.getFullYear(), today.getMonth(), 1)
    );

    // ランダムにグループを1-2個選択
    const selectedGroups = randomChoices(groups, Math.random() > 0.7 ? 2 : 1);

    // ランダムにポジションを選択
    const selectedPosition = randomChoice(positions);

    // ランダムに職掌を1個選択（roleTypeの重複を避ける）
    const selectedRole = randomChoice(functionRoles);

    const employee = await prisma.employee.create({
      data: {
        name,
        nameKana,
        hireDate,
        groups: {
          create: selectedGroups.map((group) => ({
            groupId: group.id,
            startDate: hireDate,
          })),
        },
        positions: {
          create: {
            positionId: selectedPosition.id,
            startDate: hireDate,
          },
        },
        functionRoles: {
          create: {
            functionRoleId: selectedRole.id,
            isPrimary: true,
            startDate: hireDate,
          },
        },
      },
      include: {
        groups: { include: { group: true } },
        positions: { include: { position: true } },
        functionRoles: { include: { functionRole: true } },
      },
    });

    employees.push(employee);

    if ((i + 1) % 10 === 0) {
      console.log(`${i + 1}人作成完了...`);
    }
  }

  console.log(`\n=== 作成完了 ===`);
  console.log(`従業員: ${employees.length}人`);

  // サンプル表示
  console.log("\n=== サンプル従業員（最初の5人） ===\n");
  for (let i = 0; i < 5; i++) {
    const emp = employees[i];
    console.log(`${i + 1}. ${emp.name} (${emp.nameKana})`);
    console.log(`   入社日: ${emp.hireDate?.toISOString().split("T")[0]}`);
    console.log(`   グループ: ${emp.groups.map((g) => g.group.name).join(", ")}`);
    console.log(`   ポジション: ${emp.positions.map((p) => p.position.positionName).join(", ")}`);
    console.log(`   職掌: ${emp.functionRoles.map((r) => r.functionRole?.roleName).join(", ")}`);
    console.log("");
  }

  // 最終的な件数
  const totalEmployees = await prisma.employee.count();
  console.log(`\n=== 最終結果 ===`);
  console.log(`データベース内の従業員総数: ${totalEmployees}人`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});

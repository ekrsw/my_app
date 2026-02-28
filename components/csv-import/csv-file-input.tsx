"use client"

import { useRef } from "react"
import { Button } from "@/components/ui/button"
import { Download } from "lucide-react"

type CsvFileInputProps = {
  onFileLoaded: (csvText: string) => void
  disabled?: boolean
}

export function CsvFileInput({ onFileLoaded, disabled }: CsvFileInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      let text = event.target?.result as string
      // BOM除去
      if (text.charCodeAt(0) === 0xfeff) {
        text = text.slice(1)
      }
      onFileLoaded(text)
    }
    reader.readAsText(file, "UTF-8")

    // 同じファイルを再選択できるようリセット
    if (inputRef.current) {
      inputRef.current.value = ""
    }
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        onChange={handleChange}
        className="hidden"
        disabled={disabled}
      />
      <Button
        type="button"
        variant="outline"
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
      >
        <Download className="mr-1 h-4 w-4" />
        CSVファイルを選択
      </Button>
    </div>
  )
}

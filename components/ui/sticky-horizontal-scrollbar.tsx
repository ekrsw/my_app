"use client"

import {
  useRef,
  useState,
  useEffect,
  useCallback,
  useId,
  type RefObject,
} from "react"
import { cn } from "@/lib/utils"

type StickyHorizontalScrollbarProps = {
  containerRef: RefObject<HTMLDivElement | null>
  containerId?: string
  className?: string
}

export function StickyHorizontalScrollbar({
  containerRef,
  containerId,
  className,
}: StickyHorizontalScrollbarProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const scrollbarId = useId()
  const [thumbWidth, setThumbWidth] = useState(100)
  const [thumbLeft, setThumbLeft] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [isNeeded, setIsNeeded] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const [trackWidth, setTrackWidth] = useState(0)
  const [trackLeft, setTrackLeft] = useState(0)
  const dragStartX = useRef(0)
  const dragStartScrollLeft = useRef(0)
  const isInitialized = useRef(false)

  // スクロールバーの状態を更新
  const updateScrollbar = useCallback(() => {
    const container = containerRef.current
    if (!container) return

    const { scrollWidth, clientWidth, scrollLeft } = container
    const rect = container.getBoundingClientRect()

    // トラックの幅と位置を更新
    setTrackWidth(rect.width)
    setTrackLeft(rect.left)

    if (scrollWidth <= clientWidth) {
      setIsNeeded(false)
      setThumbWidth(100)
      setThumbLeft(0)
    } else {
      setIsNeeded(true)
      const ratio = clientWidth / scrollWidth
      setThumbWidth(ratio * 100)
      const maxScrollLeft = scrollWidth - clientWidth
      setThumbLeft((scrollLeft / maxScrollLeft) * (100 - ratio * 100))
    }

    // コンテナがビューポート内にあるかどうかを判定
    const viewportHeight = window.innerHeight
    const isContainerVisible = rect.top < viewportHeight && rect.bottom > 0
    // コンテナの下端がビューポートの下端より下にある場合、fixed スクロールバーを表示
    const needsFixedScrollbar = rect.bottom > viewportHeight && rect.top < viewportHeight
    setIsVisible(isContainerVisible && needsFixedScrollbar)
  }, [containerRef])

  // 初期化
  useEffect(() => {
    if (isInitialized.current) return
    isInitialized.current = true

    const timer = setTimeout(updateScrollbar, 0)
    return () => clearTimeout(timer)
  }, [updateScrollbar])

  // scroll/resize イベントの購読
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    container.addEventListener("scroll", updateScrollbar, { passive: true })
    window.addEventListener("scroll", updateScrollbar, { passive: true })
    window.addEventListener("resize", updateScrollbar, { passive: true })

    const resizeObserver = new ResizeObserver(updateScrollbar)
    resizeObserver.observe(container)

    // MutationObserver for content changes (infinite scroll)
    const mutationObserver = new MutationObserver(updateScrollbar)
    mutationObserver.observe(container, { childList: true, subtree: true })

    return () => {
      container.removeEventListener("scroll", updateScrollbar)
      window.removeEventListener("scroll", updateScrollbar)
      window.removeEventListener("resize", updateScrollbar)
      resizeObserver.disconnect()
      mutationObserver.disconnect()
    }
  }, [containerRef, updateScrollbar])

  // ドラッグ開始
  const handleDragStart = useCallback(
    (clientX: number) => {
      const container = containerRef.current
      if (!container) return

      setIsDragging(true)
      dragStartX.current = clientX
      dragStartScrollLeft.current = container.scrollLeft
    },
    [containerRef]
  )

  // ドラッグ中
  const handleDragMove = useCallback(
    (clientX: number) => {
      if (!isDragging) return
      const container = containerRef.current
      if (!container || trackWidth === 0) return

      const deltaX = clientX - dragStartX.current
      const scrollableWidth = container.scrollWidth - container.clientWidth
      const scrollDelta =
        (deltaX / trackWidth) * (scrollableWidth / (1 - thumbWidth / 100))

      container.scrollLeft = dragStartScrollLeft.current + scrollDelta
    },
    [isDragging, thumbWidth, containerRef, trackWidth]
  )

  // ドラッグ終了
  const handleDragEnd = useCallback(() => {
    setIsDragging(false)
  }, [])

  // マウスイベント
  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => handleDragMove(e.clientX)
    const handleMouseUp = () => handleDragEnd()

    document.addEventListener("mousemove", handleMouseMove)
    document.addEventListener("mouseup", handleMouseUp)

    return () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
    }
  }, [isDragging, handleDragMove, handleDragEnd])

  // トラッククリックでジャンプ
  const handleTrackClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const container = containerRef.current
      const track = trackRef.current
      if (!container || !track || e.target !== track) return

      const rect = track.getBoundingClientRect()
      const clickX = e.clientX - rect.left
      const clickRatio = clickX / rect.width
      const scrollableWidth = container.scrollWidth - container.clientWidth
      container.scrollLeft = scrollableWidth * clickRatio
    },
    [containerRef]
  )

  if (!isNeeded || !isVisible) return null

  return (
    <div
      ref={trackRef}
      id={scrollbarId}
      className={cn("fixed bottom-0 h-3 cursor-pointer bg-muted/80 backdrop-blur-sm border-t z-50", className)}
      style={{
        left: trackLeft,
        width: trackWidth,
      }}
      onClick={handleTrackClick}
      role="scrollbar"
      aria-orientation="horizontal"
      aria-controls={containerId}
      aria-valuenow={Math.round(thumbLeft)}
      aria-valuemin={0}
      aria-valuemax={Math.round(100 - thumbWidth)}
    >
      <div
        className={cn(
          "h-full rounded-full bg-foreground/30 hover:bg-foreground/50 active:bg-foreground/60",
          isDragging && "bg-foreground/60"
        )}
        style={{
          width: `${thumbWidth}%`,
          marginLeft: `${thumbLeft}%`,
          transition: isDragging ? "none" : "margin-left 0.05s ease-out",
        }}
        onMouseDown={(e) => {
          e.preventDefault()
          handleDragStart(e.clientX)
        }}
        onTouchStart={(e) => {
          handleDragStart(e.touches[0].clientX)
        }}
        onTouchMove={(e) => {
          handleDragMove(e.touches[0].clientX)
        }}
        onTouchEnd={handleDragEnd}
      />
    </div>
  )
}

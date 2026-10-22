/**
 * 按短句换行（安卓 PhraseText）：先把句子切成短语，一个短语整个换到下一行，只有比整行还宽时才在里面断。
 * 这样窄屏、大字时不会断成「剪刀石 / 头布」。隐形的断点（U+200B）不显示。
 */
import { createElement, type ElementType, type HTMLAttributes } from 'react'
import { splitPhrases } from '../domain/phrases.ts'

export interface PhraseTextProps extends HTMLAttributes<HTMLElement> {
  readonly text: string
  /** 外面包什么标签（默认 span）。 */
  readonly as?: ElementType
}

export function PhraseText({ text, as = 'span', className, ...rest }: PhraseTextProps) {
  const phrases = splitPhrases(text)
  return createElement(
    as,
    { className: className ? `phrase-text ${className}` : 'phrase-text', ...rest },
    phrases.map((phrase, index) => (
      <span key={index} className="phrase">
        {phrase}
      </span>
    )),
  )
}

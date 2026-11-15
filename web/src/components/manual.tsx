'use client'

import { BookOpen, Check, Code2, Copy } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n'
import { manualApiSections } from '@/lib/manual-api'
import { manualInterfaceSections } from '@/lib/manual-interface'
import { manualLabels, type ManualBlock, type ManualSection } from '@/lib/manual-content'
import { Button } from './ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import styles from './manual.module.css'

function CodeExample({ block }: { block: Extract<ManualBlock, { type: 'code' }> }) {
  const { language } = useI18n()
  const [copied, setCopied] = useState(false)
  return (
    <div className={styles.example}>
      <div className={styles.exampleHeader}>
        <span>{block.title?.[language] || block.language || 'JSON'}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={manualLabels.copy[language]}
          title={manualLabels.copy[language]}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(block.code)
              setCopied(true)
              toast.success(manualLabels.copied[language])
            } catch {
              toast.error(manualLabels.copyFailed[language])
            }
          }}
        >
          {copied ? <Check size={15} /> : <Copy size={15} />}
        </Button>
      </div>
      <pre tabIndex={0} aria-label={block.title?.[language] || block.language || 'JSON'}>
        <code>{block.code}</code>
      </pre>
    </div>
  )
}

function ContentBlock({ block, title }: { block: ManualBlock; title: string }) {
  const { language } = useI18n()
  switch (block.type) {
    case 'paragraph':
      return <p>{block.text[language]}</p>
    case 'note':
      return <aside className={styles.note}>{block.text[language]}</aside>
    case 'steps':
    case 'list': {
      const List = block.type === 'steps' ? 'ol' : 'ul'
      return <List>{block.items.map((item, i) => <li key={i}>{item[language]}</li>)}</List>
    }
    case 'table':
      return (
        <div className={styles.tableScroll} role="region" aria-label={title} tabIndex={0}>
          <table>
            <thead><tr>{block.columns.map((column, i) => <th key={i} scope="col">{column[language]}</th>)}</tr></thead>
            <tbody>{block.rows.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j}>{cell[language]}</td>)}</tr>)}</tbody>
          </table>
        </div>
      )
    case 'code':
      return <CodeExample block={block} />
  }
}

function Guide({ sections, intro }: { sections: ManualSection[]; intro: string }) {
  const { language } = useI18n()
  const navigate = (id: string) => {
    const heading = document.getElementById(id)
    const scroller = heading?.closest('[data-manual-scroll]')
    if (!heading || !scroller) return
    // Only move the reading pane; the application header stays in place.
    scroller.scrollTo({ top: scroller.scrollTop + heading.getBoundingClientRect().top - scroller.getBoundingClientRect().top - 16 })
    heading.focus({ preventScroll: true })
  }
  return (
    <div className={styles.layout}>
      <nav className={styles.contents} aria-label={manualLabels.contents[language]}>
        <div className={styles.desktopContents}>
          <h2>{manualLabels.contents[language]}</h2>
          {sections.map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              onClick={(event) => { event.preventDefault(); navigate(section.id) }}
            >
              {section.title[language]}
            </a>
          ))}
        </div>
        <select
          className={`native-select ${styles.mobileContents}`}
          aria-label={manualLabels.contents[language]}
          value=""
          onChange={(event) => navigate(event.target.value)}
        >
          <option value="" disabled>{manualLabels.contents[language]}</option>
          {sections.map((section) => <option key={section.id} value={section.id}>{section.title[language]}</option>)}
        </select>
      </nav>
      <div className={styles.readingPane} data-manual-scroll>
        <article className={styles.article}>
          <p className={styles.intro}>{intro}</p>
          {sections.map((section) => (
            <section className={`panel ${styles.section}`} key={section.id} aria-labelledby={section.id}>
              <h2 id={section.id} tabIndex={-1}>{section.title[language]}</h2>
              {section.blocks.map((block, i) => <ContentBlock key={i} block={block} title={section.title[language]} />)}
            </section>
          ))}
        </article>
      </div>
    </div>
  )
}

export function Manual() {
  const { language } = useI18n()
  return (
    <Tabs defaultValue="interface" className={`resource-page ${styles.page}`}>
      <div className={styles.toolbar}>
        <TabsList aria-label={manualLabels.navigation[language]}>
          <TabsTrigger value="interface"><BookOpen size={16} />{manualLabels.interface[language]}</TabsTrigger>
          <TabsTrigger value="api"><Code2 size={16} />{manualLabels.api[language]}</TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="interface" className={styles.tabPanel}>
        <Guide sections={manualInterfaceSections} intro={manualLabels.interfaceIntro[language]} />
      </TabsContent>
      <TabsContent value="api" className={styles.tabPanel}>
        <Guide sections={manualApiSections} intro={manualLabels.apiIntro[language]} />
      </TabsContent>
    </Tabs>
  )
}

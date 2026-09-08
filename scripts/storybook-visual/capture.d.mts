import type { Browser, Page } from 'playwright'

export function serve(root: string): Promise<{ url: string; close(): Promise<void> }>

export function capture(
  browser: Browser,
  url: string,
  entry: {
    catalog: 'pages' | 'components'
    story: string
    theme: string
    viewport: { width: number; height: number }
    ready: string
  },
  options?: { prepare?: (page: Page) => void | Promise<void>; mutate?: (page: Page) => void | Promise<void>; timeout?: number },
): Promise<{ bytes: Buffer; diagnostics: string[] }>

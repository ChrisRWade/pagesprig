import type { ReactNode, SVGProps } from 'react'

function Svg(props: SVGProps<SVGSVGElement> & { title: string; children: ReactNode }) {
  const { title, children, ...rest } = props
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      <title>{title}</title>
      {children}
    </svg>
  )
}

export const Icons = {
  select: (
    <Svg title="Select">
      <path d="M5 4l6 16 2.2-6.2L19 12z" />
    </Svg>
  ),
  pencil: (
    <Svg title="Pencil">
      <path d="M4 20l4.2-1.1L19 8.1 15.9 5 5 15.9z" />
      <path d="M13.8 6.1l3.1 3.1" />
    </Svg>
  ),
  highlighter: (
    <Svg title="Highlighter">
      <path d="M5 19h7l8-8-4-4-8 8v4z" />
      <path d="M12 11l4 4" />
    </Svg>
  ),
  text: (
    <Svg title="Text">
      <path d="M5 6h14" />
      <path d="M12 6v14" />
      <path d="M8 20h8" />
    </Svg>
  ),
  line: (
    <Svg title="Line">
      <path d="M5 19L19 5" />
    </Svg>
  ),
  rect: (
    <Svg title="Rectangle">
      <rect x="5" y="6" width="14" height="12" />
    </Svg>
  ),
  ellipse: (
    <Svg title="Ellipse">
      <ellipse cx="12" cy="12" rx="8" ry="6" />
    </Svg>
  ),
  arrow: (
    <Svg title="Arrow">
      <path d="M5 19L19 5" />
      <path d="M11 5h8v8" />
    </Svg>
  ),
  check: (
    <Svg title="Checkmark">
      <path d="M5 13l4 4 10-11" />
    </Svg>
  ),
  xmark: (
    <Svg title="X mark">
      <path d="M6 6l12 12" />
      <path d="M18 6L6 18" />
    </Svg>
  ),
  eraser: (
    <Svg title="Eraser">
      <path d="M15 5l4 4-9 9H6l-3-3z" />
      <path d="M7 18h12" />
    </Svg>
  ),
  undo: (
    <Svg title="Undo">
      <path d="M8 8H4v4" />
      <path d="M4 8c3-4 13-4 16 2" />
    </Svg>
  ),
  redo: (
    <Svg title="Redo">
      <path d="M16 8h4v4" />
      <path d="M20 8c-3-4-13-4-16 2" />
    </Svg>
  )
}

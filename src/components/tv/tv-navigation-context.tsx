'use client'

import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useState,
  useRef,
  ReactNode,
} from 'react'

interface TVNavigationContextValue {
  /** Register a focusable element */
  registerFocusable: (id: string, element: HTMLElement, row?: number, col?: number) => void
  /** Unregister a focusable element */
  unregisterFocusable: (id: string) => void
  /** Currently focused element ID */
  focusedId: string | null
  /** Set focus to a specific element */
  setFocus: (id: string) => void
  /** Move focus in a direction */
  moveFocus: (direction: 'up' | 'down' | 'left' | 'right') => void
  /** Activate the currently focused element */
  activateFocused: () => void
  /** Go back (for TV remote back button) */
  goBack: () => void
}

const TVNavigationContext = createContext<TVNavigationContextValue | null>(null)

interface FocusableElement {
  id: string
  element: HTMLElement
  row: number
  col: number
}

interface TVNavigationProviderProps {
  children: ReactNode
  /** Called when back is pressed */
  onBack?: () => void
  /** Initial focused element ID */
  initialFocusId?: string
}

export function TVNavigationProvider({
  children,
  onBack,
  initialFocusId,
}: TVNavigationProviderProps) {
  const [focusedId, setFocusedId] = useState<string | null>(initialFocusId || null)
  const focusablesRef = useRef<Map<string, FocusableElement>>(new Map())
  const autoRowRef = useRef(0)
  const autoColRef = useRef(0)

  const registerFocusable = useCallback(
    (id: string, element: HTMLElement, row?: number, col?: number) => {
      // Auto-assign row/col if not provided
      const assignedRow = row ?? autoRowRef.current
      const assignedCol = col ?? autoColRef.current++

      focusablesRef.current.set(id, {
        id,
        element,
        row: assignedRow,
        col: assignedCol,
      })

      // If this is the first element or matches initial focus, focus it
      if (!focusedId || id === initialFocusId) {
        setFocusedId(id)
        element.focus()
      }
    },
    [focusedId, initialFocusId]
  )

  const unregisterFocusable = useCallback((id: string) => {
    focusablesRef.current.delete(id)
  }, [])

  const setFocus = useCallback((id: string) => {
    const focusable = focusablesRef.current.get(id)
    if (focusable) {
      setFocusedId(id)
      focusable.element.focus()
    }
  }, [])

  const moveFocus = useCallback(
    (direction: 'up' | 'down' | 'left' | 'right') => {
      if (!focusedId) {
        // Focus first element if nothing focused
        const first = Array.from(focusablesRef.current.values())[0]
        if (first) {
          setFocusedId(first.id)
          first.element.focus()
        }
        return
      }

      const current = focusablesRef.current.get(focusedId)
      if (!current) return

      const allFocusables = Array.from(focusablesRef.current.values())
      let candidates: FocusableElement[] = []

      switch (direction) {
        case 'up':
          candidates = allFocusables.filter((f) => f.row < current.row)
          break
        case 'down':
          candidates = allFocusables.filter((f) => f.row > current.row)
          break
        case 'left':
          candidates = allFocusables.filter(
            (f) => f.row === current.row && f.col < current.col
          )
          break
        case 'right':
          candidates = allFocusables.filter(
            (f) => f.row === current.row && f.col > current.col
          )
          break
      }

      if (candidates.length === 0) {
        // Try to find any element in the direction regardless of row/col alignment
        switch (direction) {
          case 'left':
            candidates = allFocusables.filter((f) => {
              const rect = f.element.getBoundingClientRect()
              const currentRect = current.element.getBoundingClientRect()
              return rect.right < currentRect.left
            })
            break
          case 'right':
            candidates = allFocusables.filter((f) => {
              const rect = f.element.getBoundingClientRect()
              const currentRect = current.element.getBoundingClientRect()
              return rect.left > currentRect.right
            })
            break
        }
      }

      if (candidates.length === 0) return

      // Find the closest candidate
      const currentRect = current.element.getBoundingClientRect()
      let closest: FocusableElement | null = null
      let closestDistance = Infinity

      for (const candidate of candidates) {
        const rect = candidate.element.getBoundingClientRect()
        const distance = Math.hypot(
          rect.left + rect.width / 2 - (currentRect.left + currentRect.width / 2),
          rect.top + rect.height / 2 - (currentRect.top + currentRect.height / 2)
        )

        if (distance < closestDistance) {
          closestDistance = distance
          closest = candidate
        }
      }

      if (closest) {
        setFocusedId(closest.id)
        closest.element.focus()
      }
    },
    [focusedId]
  )

  const activateFocused = useCallback(() => {
    if (!focusedId) return
    const focusable = focusablesRef.current.get(focusedId)
    if (focusable) {
      focusable.element.click()
    }
  }, [focusedId])

  const goBack = useCallback(() => {
    onBack?.()
  }, [onBack])

  // Keyboard event handling for TV remotes
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault()
          moveFocus('up')
          break
        case 'ArrowDown':
          e.preventDefault()
          moveFocus('down')
          break
        case 'ArrowLeft':
          e.preventDefault()
          moveFocus('left')
          break
        case 'ArrowRight':
          e.preventDefault()
          moveFocus('right')
          break
        case 'Enter':
        case ' ':
          e.preventDefault()
          activateFocused()
          break
        case 'Backspace':
        case 'Escape':
          e.preventDefault()
          goBack()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [moveFocus, activateFocused, goBack])

  return (
    <TVNavigationContext.Provider
      value={{
        registerFocusable,
        unregisterFocusable,
        focusedId,
        setFocus,
        moveFocus,
        activateFocused,
        goBack,
      }}
    >
      {children}
    </TVNavigationContext.Provider>
  )
}

export function useTVNavigation() {
  const context = useContext(TVNavigationContext)
  if (!context) {
    throw new Error('useTVNavigation must be used within a TVNavigationProvider')
  }
  return context
}

/**
 * Hook to make an element focusable in TV navigation
 */
export function useTVFocusable(
  id: string,
  options?: { row?: number; col?: number }
) {
  const { registerFocusable, unregisterFocusable, focusedId } = useTVNavigation()
  const ref = useRef<HTMLElement | null>(null)

  const setRef = useCallback(
    (element: HTMLElement | null) => {
      if (ref.current && ref.current !== element) {
        unregisterFocusable(id)
      }

      ref.current = element

      if (element) {
        registerFocusable(id, element, options?.row, options?.col)
      }
    },
    [id, registerFocusable, unregisterFocusable, options?.row, options?.col]
  )

  const isFocused = focusedId === id

  return { ref: setRef, isFocused }
}

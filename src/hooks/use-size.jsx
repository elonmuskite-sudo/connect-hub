import { useState, useRef, useEffect } from 'react'

export function useSize() {
  const [size, setSize] = useState({ width: 0, height: 0 })
  const ref = useRef(null)

  useEffect(() => {
    const updateSize = () => {
      if (ref.current) {
        setSize({
          width: ref.current.offsetWidth,
          height: ref.current.offsetHeight
        })
      }
    }

    updateSize()
    window.addEventListener('resize', updateSize)
    return () => window.removeEventListener('resize', updateSize)
  }, [])

  return [ref, size]
}

/* eslint-disable react/prop-types */
import { forwardRef } from 'react'

const ChatButton = forwardRef(function ChatButton({ className = '', variant = 'ghost', children, title, ...props }, ref) {
  return <button ref={ref} type="button" title={title} aria-label={props['aria-label'] || title} {...props} className={`chat-button ${variant === 'primary' ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'text-muted-foreground hover:bg-muted hover:text-foreground'} ${className}`}>{children}</button>
})
export default ChatButton
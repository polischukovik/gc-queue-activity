export function getStatusBorderClass(status: string = ''): string {
    switch (status) {
      case 'INTERACTING': return 'border-interacting'
      case 'NOT_RESPONDING': return 'border-not-responding'
      case 'IDLE': return 'border-idle'
      case 'OFFLINE': return 'border-offline'
      case 'AVAILABLE': return 'border-available'
      default: return 'border-offline'
    }
  }
  
  export function getHighlightClass(highlight: string = ''): string {
    if (highlight === 'warning') return 'highlight-warning'
    if (highlight === 'interacting') return 'highlight-interacting'
    return ''
  }

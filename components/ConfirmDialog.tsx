'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

type Props = {
  open: boolean
  message?: string
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({ open, message = 'Na pewno chcesz to usunąć? Tej operacji nie można cofnąć.', confirmLabel = 'Usuń', onConfirm, onCancel }: Props) {
  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onCancel() }}>
      <DialogContent className='max-w-xs'>
        <DialogHeader>
          <DialogTitle>Potwierdź</DialogTitle>
        </DialogHeader>
        <p className='text-sm text-gray-600'>{message}</p>
        <div className='flex gap-2 pt-2'>
          <Button variant='outline' className='flex-1' onClick={onCancel}>Anuluj</Button>
          <Button className='flex-1 bg-red-600 hover:bg-red-700 text-white' onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

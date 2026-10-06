'use client'
import { useRef, useState, useTransition } from 'react'
import { removeAvatarAction, uploadAvatarAction } from '@/actions/account'
import { useCart } from '@/components/cart/cart-provider'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { FormMessage } from '@/components/ui/form'

const SIZE = 256

/** Crops the chosen photo to a centred square and shrinks it, so uploads stay tiny. */
async function toSquareJpeg(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const side = Math.min(bitmap.width, bitmap.height)
  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas unavailable')
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, SIZE, SIZE)
  bitmap.close()
  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('could not encode'))), 'image/jpeg', 0.86))
}

export function AvatarForm({ avatarUrl, name, uploaded }: { avatarUrl: string | null; name: string; uploaded: boolean }) {
  const { refreshAccount } = useCart()
  const input = useRef<HTMLInputElement>(null)
  const [pending, startTransition] = useTransition()
  const [result, setResult] = useState<{ ok?: boolean; message?: string }>({})

  const run = (work: () => Promise<{ ok?: boolean; message?: string }>) =>
    startTransition(async () => {
      const state = await work().catch((): { ok?: boolean; message?: string } => ({ message: 'Could not read that picture. Try a JPG or PNG.' }))
      setResult(state)
      if (state.ok) refreshAccount()
    })

  const choose = (file: File | undefined) => {
    if (!file) return
    run(async () => {
      const formData = new FormData()
      formData.set('avatar', await toSquareJpeg(file), 'avatar.jpg')
      return uploadAvatarAction(formData)
    })
  }

  return (
    <div className="mb-6 flex items-center gap-4">
      <Avatar src={avatarUrl} name={name} className="h-20 w-20 text-3xl" />
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="glass" loading={pending} onClick={() => input.current?.click()}>
            {avatarUrl ? 'Change picture' : 'Add a picture'}
          </Button>
          {uploaded ? (
            <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(removeAvatarAction)}>
              Remove
            </Button>
          ) : null}
        </div>
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          aria-label="Profile picture"
          tabIndex={-1}
          onChange={(e) => {
            choose(e.target.files?.[0])
            e.target.value = ''
          }}
        />
        <FormMessage tone={result.ok ? 'success' : 'error'}>{result.message}</FormMessage>
      </div>
    </div>
  )
}

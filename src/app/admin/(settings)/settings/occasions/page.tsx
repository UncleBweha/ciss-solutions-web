import { OccasionManager } from '@/components/admin/occasion-manager'
import { requireStaff } from '@/lib/auth'
import { getActiveOccasion, getOccasionsForAdmin, getThemeOverride } from '@/lib/occasions/data'

export const metadata = { title: 'Occasions' }

export default async function OccasionsSettings() {
  await requireStaff('content.manage')
  const [occasions, override, active] = await Promise.all([getOccasionsForAdmin(), getThemeOverride(), getActiveOccasion()])
  return <OccasionManager occasions={occasions} override={override} active={active} />
}

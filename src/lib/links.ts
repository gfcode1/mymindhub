import type { EntityLink, LinkableType } from '@/types/models'

export interface LinkTarget {
  type: LinkableType
  id: string
  title: string
  subtitle: string
  href: string
}

export type LinkDirection = 'outgoing' | 'incoming'

export interface ResolvedEntityLink {
  link: EntityLink
  target: LinkTarget
  direction: LinkDirection
}

export interface EntityLinkGroups {
  outgoing: ResolvedEntityLink[]
  incoming: ResolvedEntityLink[]
}

export function entityKey(type: LinkableType, id: string): string {
  return `${type}:${id}`
}

export function resolveEntityLinks(
  links: EntityLink[],
  targets: LinkTarget[],
  type: LinkableType,
  id: string,
): EntityLinkGroups {
  const byKey = new Map(targets.map((target) => [entityKey(target.type, target.id), target]))
  const outgoing: ResolvedEntityLink[] = []
  const incoming: ResolvedEntityLink[] = []
  const seen = new Set<string>()

  for (const link of links) {
    if (link.deletedAt) continue
    const isOutgoing = link.sourceType === type && link.sourceId === id
    const isIncoming = link.targetType === type && link.targetId === id
    if (!isOutgoing && !isIncoming) continue

    const otherType = isOutgoing ? link.targetType : link.sourceType
    const otherId = isOutgoing ? link.targetId : link.sourceId
    const key = entityKey(otherType, otherId)
    if (seen.has(key)) continue
    const target = byKey.get(key)
    if (!target) continue
    seen.add(key)
    const resolved: ResolvedEntityLink = {
      link,
      target,
      direction: isOutgoing ? 'outgoing' : 'incoming',
    }
    if (isOutgoing) outgoing.push(resolved)
    else incoming.push(resolved)
  }

  const sort = (items: ResolvedEntityLink[]) =>
    items.sort((a, b) => a.target.title.localeCompare(b.target.title))

  return { outgoing: sort(outgoing), incoming: sort(incoming) }
}

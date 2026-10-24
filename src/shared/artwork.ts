/**
 * SoundCloud encodes the rendered size in its image filenames, e.g.
 * `artworks-000123456789-abcdef-t50x50.jpg`. The 50px variant is what the site
 * ships for tiny player avatars, and it turns into mush the moment a cover is
 * drawn larger than a thumbnail.
 *
 * Rewriting the size token to the largest public variant costs the same single
 * request and keeps the helper in one place so the site preload and the
 * renderer agree. Unknown hosts are returned untouched.
 */

const SIZE_TOKEN = /-(t\d+x\d+|tiny|mini|small|large|crop|badge|original)\.(jpe?g|png|webp)$/i

export function upgradeArtworkUrl(raw: string): string {
  if (!raw) return ''
  const url = raw.trim().replace(/^http:\/\//i, 'https://')
  if (!/sndcdn\.com\//i.test(url)) return url

  // Profile pictures only expose the avatar ladder (tiny/small/large/crop).
  // Asking for an artwork size there returns 404.
  if (/\/avatars-/i.test(url)) return url.replace(SIZE_TOKEN, '-large.$2')

  const target = /\/visuals-/i.test(url) ? 't1240x600' : 't500x500'
  return url.replace(SIZE_TOKEN, `-${target}.$2`)
}

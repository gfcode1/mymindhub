import backup from './1F4BE.svg'
import birthday from './1F382.svg'
import bookmark from './1F516.svg'
import books from './1F4DA.svg'
import brain from './1F9E0.svg'
import broom from './1F9F9.svg'
import calendar from './1F4C5.svg'
import celebrate from './1F389.svg'
import chart from './1F4C8.svg'
import clean from './1F9F9.svg'
import droplet from './1F4A7.svg'
import expenses from './1F4B8.svg'
import food from './1F34E.svg'
import habit from './1F331.svg'
import idea from './1F4A1.svg'
import inbox from './1F4E5.svg'
import journal from './1F4D4.svg'
import meditate from './1F9D8.svg'
import microphone from './1F399.svg'
import mind from './1F9E0.svg'
import music from './1F3B5.svg'
import note from './1F4DD.svg'
import rest from './1F4A4.svg'
import run from './1F3C3.svg'
import search from './1F50D.svg'
import sleep from './1F634.svg'
import star from './2B50.svg'
import strength from './1F4AA.svg'
import sun from './1F31E.svg'
import target from './1F3AF.svg'
import todo from './2705.svg'
import walk from './1F6B6.svg'
import water from './1F4A7.svg'

export const OPENMOJI = {
  backup,
  birthday,
  calendar,
  bookmark,
  books,
  brain,
  celebrate,
  chart,
  clean,
  droplet,
  expenses,
  food,
  habit,
  idea,
  inbox,
  journal,
  meditate,
  microphone,
  music,
  note,
  rest,
  run,
  search,
  sleep,
  star,
  strength,
  sun,
  target,
  todo,
  walk,
  water,
  broom,
  mind,
} as const

export type OpenMojiName = keyof typeof OPENMOJI

export const OPENMOJI_BY_CODE: Record<string, string> = {
  '1F331': habit,
  '1F3C3': run,
  '1F4DA': books,
  '1F9D8': meditate,
  '1F4A7': droplet,
  '1F34E': food,
  '1F6B6': walk,
  '1F3B5': music,
  '1F4DD': note,
  '1F4AA': strength,
  '1F634': sleep,
  '1F9F9': clean,
  '1F382': birthday,
  '1F4B8': expenses,
  '1F31E': sun,
  '2B50': star,
  '1F3AF': target,
  '1F9E0': mind,
  '1F4A4': rest,
  '1F525': habit,
}

export function openMoji(code: string): string | undefined {
  return OPENMOJI_BY_CODE[code]
}

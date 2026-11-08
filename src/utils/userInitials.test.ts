import { describe, expect, it } from 'vitest'

import { getUserInitials } from './userInitials'

type InitialsCase = {
  name: string
  displayName: string | null | undefined
  email: string | null | undefined
  expected: string | undefined
}

describe('getUserInitials', () => {
  it.for<InitialsCase>([
    {
      name: 'two words',
      displayName: 'Marwan Mostafa',
      email: 'someone@example.com',
      expected: 'MM'
    },
    {
      name: 'three words',
      displayName: 'Mary Jane Watson',
      email: null,
      expected: 'MW'
    },
    {
      name: 'one word',
      displayName: 'Marwan',
      email: null,
      expected: 'MA'
    },
    {
      name: 'one letter',
      displayName: 'M',
      email: 'someone@example.com',
      expected: 'M'
    },
    {
      name: 'extra whitespace',
      displayName: '  Marwan \t  Mostafa \n',
      email: null,
      expected: 'MM'
    },
    {
      name: 'lowercase input',
      displayName: 'ada lovelace',
      email: null,
      expected: 'AL'
    },
    {
      name: 'punctuation around the letters',
      displayName: "(Dr.) O'Brien",
      email: null,
      expected: 'DO'
    },
    {
      name: 'punctuation inside one word',
      displayName: "O'Brien",
      email: null,
      expected: 'OB'
    },
    {
      name: 'Cyrillic name',
      displayName: 'иван петров',
      email: null,
      expected: 'ИП'
    },
    {
      name: 'Japanese name',
      displayName: '山田 太郎',
      email: null,
      expected: '山太'
    },
    {
      name: 'Arabic name',
      displayName: 'مروان مصطفى',
      email: null,
      expected: 'مم'
    },
    {
      name: 'astral letters',
      displayName: '𠮷野家',
      email: null,
      expected: '𠮷野'
    },
    {
      name: 'emoji word next to a name',
      displayName: '🎨 Painter',
      email: null,
      expected: '🎨P'
    },
    {
      name: 'emoji only',
      displayName: '😀🎨🚀',
      email: null,
      expected: '😀🎨'
    },
    {
      name: 'emoji before the letters of a word',
      displayName: '🚀marwan',
      email: null,
      expected: 'MA'
    },
    {
      name: 'email when the name is missing',
      displayName: null,
      email: 'marwan@comfy.org',
      expected: 'MA'
    },
    {
      name: 'email when the name is blank',
      displayName: '   ',
      email: 'j.doe@example.com',
      expected: 'JD'
    },
    {
      name: 'email without a domain',
      displayName: undefined,
      email: 'marwan',
      expected: 'MA'
    },
    {
      name: 'nothing given',
      displayName: undefined,
      email: undefined,
      expected: undefined
    },
    {
      name: 'empty name and email',
      displayName: '',
      email: '',
      expected: undefined
    },
    {
      name: 'email with no local part',
      displayName: null,
      email: '@example.com',
      expected: undefined
    }
  ])('$name', ({ displayName, email, expected }) => {
    expect(getUserInitials(displayName, email)).toBe(expected)
  })
})

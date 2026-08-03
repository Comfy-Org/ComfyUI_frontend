export type UserState =
  | { kind: 'LocalAndUnsubscribed' }
  | { kind: 'LocalAndUnknown' }
  | { kind: 'LocalAndFree' }
  | { kind: 'LocalAndStandard' }
  | { kind: 'LocalAndCreator' }
  | { kind: 'LocalAndPro' }
  | { kind: 'LocalAndFounders' }
  | { kind: 'LocalAndTeam' }
  | { kind: 'CloudAndUnsubscribed' }
  | { kind: 'CloudAndUnknown' }
  | { kind: 'CloudAndFree' }
  | { kind: 'CloudAndStandard' }
  | { kind: 'CloudAndCreator' }
  | { kind: 'CloudAndPro' }
  | { kind: 'CloudAndFounders' }
  | { kind: 'CloudAndTeam' }

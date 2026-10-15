import { describe, expect, it } from 'vitest'
import { folderStudent, isStudentFolderName, profileForFolder, profileForWork, studentFolder } from './folderStudents'
import type { Student } from './types'

const abel: Student = {
  id: 'abel-id',
  name: 'Abel',
  avatar: '🦊',
  accentColor: '#2A6F6F',
  subjects: [],
  createdAt: '2026-10-01T00:00:00.000Z'
}

describe('schoolwork folders', () => {
  it('treats each top-level schoolwork folder as a student', () => {
    expect(isStudentFolderName('Abel')).toBe(true)
    expect(isStudentFolderName('.pagesprig')).toBe(false)
    expect(isStudentFolderName('packet')).toBe(false)
    expect(studentFolder('G:/My Drive/PageSprig', 'G:/My Drive/PageSprig/Abel/2026/10/Fractions/2026-10-12')).toBe(
      'Abel'
    )
    expect(studentFolder('G:\\My Drive\\PageSprig', 'G:\\My Drive\\PageSprig\\Lana\\Math')).toBe('Lana')
  })

  it('matches a folder to a settings profile by name', () => {
    expect(profileForFolder('abel', [abel])?.id).toBe('abel-id')
    expect(folderStudent('Casper', [abel], 1).profile).toBeNull()
    expect(folderStudent('Abel', [abel]).avatar).toBe('🦊')
  })

  it('opens folder work even when the saved student id does not match a profile', () => {
    expect(profileForWork([abel], 'missing-id', 'Abel')?.id).toBe('abel-id')
    expect(profileForWork([abel], 'abel-id', null)?.id).toBe('abel-id')
    expect(profileForWork([abel], 'missing-id', 'Casper')).toBeNull()
  })
})

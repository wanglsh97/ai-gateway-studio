export const SKILL_UPLOAD_SIGNER_PORT = Symbol('SKILL_UPLOAD_SIGNER_PORT')

export interface SignSkillUploadInput {
  objectKey: string
  contentType: 'application/zip'
  contentLength: number
  sha256: string
  expiresInSeconds: number
}

export interface SignedSkillUpload {
  url: string
  method: 'PUT'
  headers: Record<string, string>
  expiresAt: string
}

export interface SkillUploadSignerPort {
  signSkillUpload(input: SignSkillUploadInput): Promise<SignedSkillUpload>
}

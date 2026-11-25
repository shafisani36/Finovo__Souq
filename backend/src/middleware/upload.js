import multer from 'multer'

const MB = 1024 * 1024

// Files stay in memory only until they are checked and re-encoded by the storage service
const memoryUpload = (fileSize, files) => multer({ storage: multer.memoryStorage(), limits: { fileSize, files, fields: 10 } })

export const listingPhotosUpload = memoryUpload(8 * MB, 10).array('photos', 10)
export const avatarUpload = memoryUpload(5 * MB, 1).single('avatar')
export const chatAttachmentUpload = memoryUpload(8 * MB, 1).single('file')

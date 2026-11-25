import multer from 'multer'

// Turns library errors into messages a user can act on
const normalize = (err) => {
  if (err instanceof multer.MulterError) {
    const message = err.code === 'LIMIT_FILE_SIZE' ? 'File is too large' : err.code === 'LIMIT_FILE_COUNT' ? 'Too many files' : 'Invalid file upload'
    return { statusCode: 400, message }
  }
  if (err.name === 'CastError') return { statusCode: 404, message: 'Not found' }
  if (err.code === 11000) return { statusCode: 409, message: 'This already exists' }
  return err
}

const errorHandler = (err, req, res, next) => {
  const error = normalize(err)
  const statusCode =
    Number.isInteger(error.statusCode) &&
    error.statusCode >= 400 &&
    error.statusCode <= 599
      ? error.statusCode
      : 500

  const isProduction = process.env.NODE_ENV === 'production'

  if (statusCode >= 500) {
    console.error('Server Error:', err)
  }

  res.status(statusCode).json({
    success: false,
    message:
      isProduction && statusCode >= 500
        ? 'Internal Server Error'
        : error.message || 'Something went wrong',
    ...(err.errors?.length && { errors: err.errors }),
    ...( !isProduction && { stack: err.stack }),
  })
}

export default errorHandler

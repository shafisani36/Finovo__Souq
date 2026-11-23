
const errorHandler = (err, req, res, next) => {
  const statusCode =
    Number.isInteger(err.statusCode) &&
    err.statusCode >= 400 &&
    err.statusCode <= 599
      ? err.statusCode
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
        : err.message || 'Something went wrong',
    ...( !isProduction && { stack: err.stack }),
  })
}

export default errorHandler


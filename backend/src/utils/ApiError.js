/**
 * An error the client is allowed to see.
 * `errors` holds field problems as { field, message } so forms can show them next to the right input.
 */
class ApiError extends Error {
  constructor(statusCode, message, errors = []) {
    super(message)
    this.statusCode = statusCode
    this.errors = errors
  }

  static validation(fieldErrors) {
    const errors = Object.entries(fieldErrors).map(([field, message]) => ({ field, message }))
    return new ApiError(400, 'Validation failed', errors)
  }

  static notFound(message = 'Not found') {
    return new ApiError(404, message)
  }
}

export default ApiError

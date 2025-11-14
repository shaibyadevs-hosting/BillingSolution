/**
 * Generate a secure password for employees
 * Password should be different from employee ID for security
 */

/**
 * Generates a 6-character password based on employee ID and store code
 * Format: First 2 chars of employee_id + 4 random digits
 * Example: Employee ID "GO02" + Store "GO" = "GO" + "1234" = "GO1234"
 */
export function generateEmployeePassword(employeeId: string, storeCode?: string): string {
  // Take first 2 characters of employee ID or store code
  const prefix = (storeCode?.slice(0, 2) || employeeId.slice(0, 2)).toUpperCase()
  
  // Generate 4 random digits
  const digits = Math.floor(1000 + Math.random() * 9000).toString()
  
  return `${prefix}${digits}`
}

/**
 * Generates a completely random 8-character alphanumeric password
 */
export function generateRandomPassword(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let password = ''
  for (let i = 0; i < 8; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return password
}

/**
 * Generates a password that's guaranteed to be different from employee ID
 * Uses a combination of employee ID and random suffix
 */
export function generateSecurePassword(employeeId: string): string {
  // If employee ID is 4 chars, add 4 random digits
  if (employeeId.length === 4) {
    const suffix = Math.floor(1000 + Math.random() * 9000).toString()
    return `${employeeId}${suffix}`
  }
  
  // Otherwise generate random
  return generateRandomPassword()
}











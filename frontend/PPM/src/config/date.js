import dayjs from 'dayjs'

export const DISPLAY_DATE_FORMAT = 'DD-MM-YYYY'
export const DISPLAY_DATETIME_FORMAT = 'DD-MM-YYYY'

export function formatDate(value) {
  if (!value) return ''
  const d = dayjs(value)
  return d.isValid() ? d.format(DISPLAY_DATE_FORMAT) : String(value)
}

export function formatDateTime(value) {
  if (!value) return ''
  const d = dayjs(value)
  return d.isValid() ? d.format(DISPLAY_DATETIME_FORMAT) : String(value)
}

export function formatIndianNumber(num) {
  if (!num && num !== 0) return '-'
  // Remove any existing commas first, then split on decimal point
  const x = num.toString().replace(/,/g, '').split('.')
  let lastThree = x[0].slice(-3)
  const otherNumbers = x[0].slice(0, -3)
  if (otherNumbers !== '')
    lastThree = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + lastThree
  return lastThree
}

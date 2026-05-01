import { add, subtract, multiply, divide } from './calculator'

describe('calculator', () => {
  test('add', () => {
    expect(add(1, 2)).toBe(3)
  })

  test('subtract', () => {
    expect(subtract(5, 3)).toBe(2)
  })

  test('multiply', () => {
    expect(multiply(2, 3)).toBe(6)
  })

  test('divide', () => {
    expect(divide(6, 3)).toBe(2)
  })

  test('divide by zero throws', () => {
    expect(() => divide(1, 0)).toThrow('Division by zero')
  })
})

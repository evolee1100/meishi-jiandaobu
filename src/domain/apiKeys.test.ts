import { describe, expect, it } from 'vitest'
import { apiKeyProblem, cleanApiKey } from './apiKeys.ts'

// 测试用的假密钥：拆开来写，源码里不会出现一整串像真密钥的字。
const key = ['AI', 'za', 'SyA1b2C3d4E5f6G7h8I9j0K-L_mNoPqRsTu'].join('')

describe('二、API 密钥的清理和检查', () => {
  it('KEY-01 零宽空格、BOM、方向标记、换行和空格都被去掉', () => {
    expect(cleanApiKey(`​${key}​`)).toBe(key)
    expect(cleanApiKey(`﻿${key}`)).toBe(key)
    expect(cleanApiKey(`‪${key}‬‎`)).toBe(key)
    expect(cleanApiKey(`  ${key} \n`)).toBe(key)
    expect(cleanApiKey(`${key.slice(0, 10)} ${key.slice(10)}`)).toBe(key)
  })

  it('KEY-02 全角字母数字转成半角', () => {
    expect(cleanApiKey('ＡＩｚａ１２－＿')).toBe('AIza12-_')
  })

  it('KEY-03 连同「密钥：…。」一起粘进来的中文和标点被丢掉', () => {
    expect(cleanApiKey(`密钥：${key}。`)).toBe(key)
  })

  it('KEY-04 正确的密钥清理后一字不变', () => {
    expect(cleanApiKey(key)).toBe(key)
  })

  it('KEY-05 空白 = 没有密钥；有零宽空格、空格、全角字 = 格式不对；正确的没有问题', () => {
    expect(apiKeyProblem('')).toBe('NO_API_KEY')
    expect(apiKeyProblem('   ')).toBe('NO_API_KEY')
    expect(apiKeyProblem('AIza​test')).toBe('INVALID_API_KEY')
    expect(apiKeyProblem('AIza test')).toBe('INVALID_API_KEY')
    expect(apiKeyProblem('ＡＩｚａ')).toBe('INVALID_API_KEY')
    expect(apiKeyProblem(key)).toBeNull()
  })
})

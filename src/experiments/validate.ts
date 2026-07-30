import {isRecord} from '../lib/guards'
import type {PostHogExperiment} from '../types'

/**
 * Plugin-internal validation of the host fetcher's (or static array's) result.
 * Not exported from the package (ROB-2469 soft-edge ruling 2): malformed
 * shapes surface in the plugin's own error Card, naming the offending field.
 */
export function validateExperiments(value: unknown): PostHogExperiment[] {
  if (!Array.isArray(value)) {
    throw new Error(
      `The experiments source returned ${describe(value)} — expected an array of PostHogExperiment objects`,
    )
  }
  value.forEach((experiment: unknown, index) => {
    if (!isRecord(experiment)) {
      throw new Error(
        `Experiment at index ${index} is ${describe(experiment)} — expected an object`,
      )
    }
    const record = experiment
    if (typeof record.featureFlagKey !== 'string' || record.featureFlagKey.length === 0) {
      const name = typeof record.name === 'string' ? ` ("${record.name}")` : ''
      throw new Error(`Experiment at index ${index}${name} is missing "featureFlagKey"`)
    }
    if (!Array.isArray(record.variants)) {
      throw new Error(
        `Experiment "${record.featureFlagKey}" is missing "variants" (expected an array)`,
      )
    }
  })
  // oxlint-disable-next-line no-unsafe-type-assertion -- shape checked above
  return value as PostHogExperiment[]
}

function describe(value: unknown): string {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'an array'
  return `a ${typeof value}`
}

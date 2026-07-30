import {Badge, Flex, Select, Spinner, Stack, Text} from '@sanity/ui'
import {useCallback} from 'react'
import {set, unset, useFormValue, type StringInputProps} from 'sanity'

import {CONTROL_VARIANT_KEY} from '../constants'
import {useExperimentList, useExperimentsContext} from '../experiments/context'
import {readString, readVariantStubs} from '../lib/guards'
import {ExperimentsBoundary} from './ExperimentsBoundary'

export function PostHogVariantKeySelect(props: StringInputProps): React.JSX.Element {
  const ctx = useExperimentsContext()

  if (ctx.kind === 'unconfigured') {
    // Mirrors the provider states: no source configured → plain manual input.
    return <>{props.renderDefault(props)}</>
  }

  return (
    <ExperimentsBoundary
      key={ctx.token}
      onRetry={ctx.refresh}
      fallback={
        <Flex align="center" gap={2} padding={2}>
          <Spinner muted />
          <Text size={1} muted>
            Loading variants…
          </Text>
        </Flex>
      }
      renderError={() => <>{props.renderDefault(props)}</>}
    >
      <VariantKeySelectInner {...props} />
    </ExperimentsBoundary>
  )
}

function VariantKeySelectInner(props: StringInputProps): React.JSX.Element {
  const experiments = useExperimentList()

  // Read the selected experiment flag key from the parent A/B test document
  const posthogFlagKey = readString(useFormValue(['posthogFlagKey']))

  // Read sibling variants to know which keys are already assigned
  const allVariants = readVariantStubs(useFormValue(['variants']))

  const match = experiments.find((experiment) => experiment.featureFlagKey === posthogFlagKey)
  const variants = match?.variants ?? []

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      const value = event.currentTarget.value
      props.onChange(value ? set(value) : unset())
    },
    [props],
  )

  // Which variant keys are already used by other entries
  const usedKeys = new Set(
    allVariants
      .map((variant) => variant.variantKey)
      .filter((key): key is string => Boolean(key) && key !== props.value),
  )

  // Fallback: plain text input when no experiment is selected or the selected
  // experiment has no variants to offer
  if (!posthogFlagKey || variants.length === 0) {
    return (
      <Stack gap={2}>
        {props.renderDefault(props)}
        {!posthogFlagKey && (
          <Text size={0} muted>
            Select a PostHog experiment first.
          </Text>
        )}
      </Stack>
    )
  }

  const selectedVariant = variants.find((variant) => variant.key === props.value)

  return (
    <Stack gap={2}>
      <Select value={props.value || ''} onChange={handleChange} fontSize={1}>
        <option value="">Select a variant…</option>
        {variants.map((variant) => {
          const isUsed = usedKeys.has(variant.key)
          return (
            <option key={variant.key} value={variant.key} disabled={isUsed}>
              {variant.label ?? variant.key}
              {typeof variant.rolloutPercentage === 'number'
                ? ` (${variant.rolloutPercentage}%)`
                : ''}
              {isUsed ? ' — already assigned' : ''}
            </option>
          )
        })}
      </Select>

      {selectedVariant && (
        <Flex align="center" gap={2}>
          <Badge tone={props.value === CONTROL_VARIANT_KEY ? 'default' : 'primary'}>
            {props.value}
          </Badge>
          {typeof selectedVariant.rolloutPercentage === 'number' && (
            <Text size={0} muted>
              {selectedVariant.rolloutPercentage}% traffic
            </Text>
          )}
        </Flex>
      )}
    </Stack>
  )
}

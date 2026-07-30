import {RefreshIcon} from '@sanity/icons/Refresh'
import {WarningOutlineIcon} from '@sanity/icons/WarningOutline'
import {
  Badge,
  Box,
  Button,
  Card,
  Flex,
  Select,
  Spinner,
  Stack,
  Text,
  type BadgeTone,
  type CardTone,
} from '@sanity/ui'
import {useCallback} from 'react'
import {set, unset, useDocumentOperation, useFormValue, type StringInputProps} from 'sanity'

import {useExperimentList, useExperimentsContext} from '../experiments/context'
import {buildAddMissingVariantsPatches, computeVariantSync} from '../experiments/sync'
import {readString, readVariantStubs} from '../lib/guards'
import type {PostHogExperiment, PostHogExperimentStatus} from '../types'
import {ExperimentsBoundary} from './ExperimentsBoundary'

const STATUS_BADGES: Record<PostHogExperimentStatus, {label: string; tone: BadgeTone}> = {
  draft: {label: 'Draft', tone: 'default'},
  running: {label: 'Running', tone: 'positive'},
  paused: {label: 'Paused', tone: 'caution'},
  exposure_frozen: {label: 'Enrollment frozen', tone: 'positive'},
  complete: {label: 'Ended', tone: 'critical'},
}

const OPTION_SUFFIXES: Record<PostHogExperimentStatus, string> = {
  draft: ' — Draft',
  running: '',
  paused: ' — Paused',
  exposure_frozen: ' — Enrollment frozen',
  complete: ' — Ended',
}

function statusBadge(status: PostHogExperimentStatus) {
  return STATUS_BADGES[status] ?? STATUS_BADGES.draft
}

function ExperimentStatusBadge({status}: {status: PostHogExperimentStatus}) {
  const {label, tone} = statusBadge(status)
  return <Badge tone={tone}>{label}</Badge>
}

function cardToneFor(status: PostHogExperimentStatus): CardTone {
  switch (status) {
    case 'running':
    case 'exposure_frozen':
      return 'positive'
    case 'complete':
      return 'critical'
    case 'draft':
    case 'paused':
    default:
      return 'caution'
  }
}

function LoadingCard() {
  return (
    <Stack gap={3}>
      <Card padding={3} radius={2} border>
        <Flex align="center" gap={3}>
          <Spinner muted />
          <Text size={1} muted>
            Loading experiments from PostHog…
          </Text>
        </Flex>
      </Card>
    </Stack>
  )
}

export function PostHogExperimentSelect(props: StringInputProps): React.JSX.Element {
  const ctx = useExperimentsContext()

  if (ctx.kind === 'unconfigured') {
    // Addressed to the developer; editors keep working via the manual input.
    // Never a silent plain string field.
    return (
      <Stack gap={3}>
        <Card tone="critical" padding={3} radius={2} border>
          <Flex align="flex-start" gap={3}>
            <Text size={1}>
              <WarningOutlineIcon />
            </Text>
            <Text size={1}>
              No experiments source is configured. Pass <code>experiments</code> (an array or an
              async fetcher) to <code>posthogAbTesting()</code> in sanity.config — see the README.
            </Text>
          </Flex>
        </Card>
        {props.renderDefault(props)}
      </Stack>
    )
  }

  return (
    <ExperimentsBoundary
      key={ctx.token}
      onRetry={ctx.refresh}
      fallback={<LoadingCard />}
      renderError={(error, retry) => (
        <Stack gap={3}>
          <Card tone="critical" padding={3} radius={2} border>
            <Stack gap={3}>
              <Flex align="flex-start" gap={3}>
                <Text size={1}>
                  <WarningOutlineIcon />
                </Text>
                <Text size={1}>Couldn&apos;t load experiments from PostHog: {error.message}.</Text>
              </Flex>
              <Box>
                <Button
                  text="Retry"
                  icon={RefreshIcon}
                  tone="critical"
                  mode="ghost"
                  fontSize={1}
                  onClick={retry}
                />
              </Box>
              <Text size={1} muted>
                You can paste the feature flag key manually below.
              </Text>
            </Stack>
          </Card>
          {props.renderDefault(props)}
        </Stack>
      )}
    >
      <ExperimentSelectInner {...props} />
    </ExperimentsBoundary>
  )
}

function ExperimentSelectInner(props: StringInputProps): React.JSX.Element {
  const ctx = useExperimentsContext()
  const experiments = useExperimentList()

  const documentId = readString(useFormValue(['_id']))
  const documentType = readString(useFormValue(['_type']))
  const currentVariants = readVariantStubs(useFormValue(['variants']))

  const publishedId = (documentId ?? '').replace(/^drafts\./, '')
  const {patch} = useDocumentOperation(publishedId, documentType ?? '')

  const refresh = ctx.kind === 'unconfigured' ? undefined : ctx.refresh

  const handleSelectChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      const value = event.currentTarget.value
      props.onChange(value ? set(value) : unset())
    },
    [props],
  )

  const selected = experiments.find((experiment) => experiment.featureFlagKey === props.value)
  const storedKeyMissing = Boolean(props.value) && !selected

  const currentKeys = currentVariants
    .map((variant) => variant.variantKey)
    .filter((key): key is string => Boolean(key))
  const posthogKeys = selected?.variants.map((variant) => variant.key) ?? []
  const {missing, stale, inSync} = computeVariantSync(currentKeys, posthogKeys)

  const handleAddMissing = () => {
    if (missing.length === 0 || patch.disabled) return
    patch.execute(buildAddMissingVariantsPatches(missing))
  }

  if (experiments.length === 0) {
    return (
      <Stack gap={3}>
        <Card tone="caution" padding={3} radius={2} border>
          <Stack gap={3}>
            <Text size={1}>
              No experiments found in PostHog. Create one in PostHog and reload — or paste a feature
              flag key manually below.
            </Text>
            {refresh && (
              <Box>
                <Button
                  text="Reload"
                  icon={RefreshIcon}
                  mode="ghost"
                  fontSize={1}
                  onClick={refresh}
                />
              </Box>
            )}
          </Stack>
        </Card>
        {props.renderDefault(props)}
      </Stack>
    )
  }

  const definedRollouts = (selected?.variants ?? [])
    .map((variant) => variant.rolloutPercentage)
    .filter((value): value is number => typeof value === 'number')
  const maxRollout = definedRollouts.length > 0 ? Math.max(...definedRollouts) : null

  return (
    <Stack gap={3}>
      <Flex gap={2} align="center">
        <Box flex={1}>
          <Select value={props.value || ''} onChange={handleSelectChange} fontSize={1}>
            <option value="">Select an experiment…</option>
            {storedKeyMissing && (
              <option value={props.value} disabled>
                {props.value} (not found in PostHog)
              </option>
            )}
            {experiments.map((experiment) => (
              <option key={experiment.id} value={experiment.featureFlagKey}>
                {experiment.name} ({experiment.featureFlagKey})
                {OPTION_SUFFIXES[experiment.status] ?? ''}
              </option>
            ))}
          </Select>
        </Box>
        {refresh && (
          <Button
            text="Reload experiments"
            icon={RefreshIcon}
            mode="ghost"
            fontSize={1}
            onClick={refresh}
          />
        )}
      </Flex>

      {storedKeyMissing && (
        <Card tone="caution" padding={3} radius={2} border>
          <Text size={1}>
            <code>{props.value}</code> was not found in PostHog. The experiment may have been
            deleted or its flag key changed. Reload experiments, pick a replacement, or disable this
            A/B test.
          </Text>
        </Card>
      )}

      {selected && (
        <Card padding={3} radius={2} tone={cardToneFor(selected.status)} border>
          <Stack gap={3}>
            <Flex align="center" gap={2}>
              <ExperimentStatusBadge status={selected.status} />
              <Text size={1} weight="medium">
                {selected.name}
              </Text>
            </Flex>

            <Box>
              <Text size={1}>
                Flag key: <code>{selected.featureFlagKey}</code>
              </Text>
            </Box>

            {selected.variants.length > 0 && (
              <VariantChips experiment={selected} maxRollout={maxRollout} />
            )}

            {selected.variants.length > 0 && !inSync && (
              <Card tone="caution" padding={3} radius={2}>
                <Stack gap={3}>
                  <Text size={1}>
                    Variant pages don&apos;t match PostHog.
                    {missing.length > 0 && <> Missing here: {missing.join(', ')}.</>}
                    {stale.length > 0 && <> Not in the selected experiment: {stale.join(', ')}.</>}
                  </Text>
                  {missing.length > 0 && (
                    <Box>
                      <Button
                        text="Add missing variants"
                        tone="caution"
                        mode="ghost"
                        fontSize={1}
                        disabled={Boolean(patch.disabled)}
                        onClick={handleAddMissing}
                      />
                    </Box>
                  )}
                </Stack>
              </Card>
            )}

            {selected.status === 'complete' && (
              <Card tone="critical" padding={3} radius={2}>
                <Flex align="flex-start" gap={3}>
                  <Text size={1}>
                    <WarningOutlineIcon />
                  </Text>
                  <Text size={1}>
                    This experiment has ended in PostHog. Disable this A/B test in Sanity or the
                    winning variant will keep being served.
                  </Text>
                </Flex>
              </Card>
            )}

            {selected.status === 'draft' && (
              <Card tone="caution" padding={2} radius={2}>
                <Text size={1}>
                  This experiment is still a draft. Launch it in PostHog before enabling this A/B
                  test.
                </Text>
              </Card>
            )}

            {selected.status === 'paused' && (
              <Card tone="caution" padding={2} radius={2}>
                <Text size={1}>
                  This experiment is paused in PostHog. Variants are not being served; the control
                  page is shown to everyone. Resume it in PostHog to continue the test.
                </Text>
              </Card>
            )}

            {selected.status === 'exposure_frozen' && (
              <Text size={0} muted>
                Enrollment is frozen in PostHog. Existing participants keep their variant; new
                visitors are no longer enrolled.
              </Text>
            )}

            {selected.status === 'running' && inSync && (
              <Text size={0} muted>
                Traffic split, targeting, and scheduling are managed in the PostHog dashboard.
              </Text>
            )}
          </Stack>
        </Card>
      )}
    </Stack>
  )
}

function VariantChips(props: {experiment: PostHogExperiment; maxRollout: number | null}) {
  const {experiment, maxRollout} = props
  return (
    <Card padding={3} radius={2} tone="transparent" border>
      <Stack gap={3}>
        <Text size={1} weight="medium">
          Variants ({experiment.variants.length})
        </Text>
        <Flex gap={2} wrap="wrap">
          {experiment.variants.map((variant) => (
            <Card
              key={variant.key}
              padding={2}
              paddingX={3}
              radius={2}
              tone={
                typeof variant.rolloutPercentage === 'number' &&
                maxRollout !== null &&
                variant.rolloutPercentage === maxRollout
                  ? 'primary'
                  : 'default'
              }
              border
            >
              <Flex align="center" gap={3}>
                <Text size={1} weight="medium">
                  {variant.label ?? variant.key}
                </Text>
                {typeof variant.rolloutPercentage === 'number' && (
                  <Card padding={1} paddingX={2} radius={2} tone="default" border>
                    <Text size={0} muted>
                      {variant.rolloutPercentage}%
                    </Text>
                  </Card>
                )}
              </Flex>
            </Card>
          ))}
        </Flex>
      </Stack>
    </Card>
  )
}

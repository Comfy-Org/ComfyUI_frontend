import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@testing-library/vue'
import { expect, it } from 'vitest'
import { ref } from 'vue'
import { createI18n } from 'vue-i18n'

import CardBottom from '@/components/card/CardBottom.vue'
import CardContainer from '@/components/card/CardContainer.vue'
import CardTop from '@/components/card/CardTop.vue'
import ComfyLogo from '@/components/icons/ComfyLogo.vue'
import PuzzleIcon from '@/components/icons/PuzzleIcon.vue'
import VerifiedIcon from '@/components/icons/VerifiedIcon.vue'
import Loader from '@/components/loader/Loader.vue'
import ButtonGroup from '@/components/ui/button-group/ButtonGroup.vue'
import Button from '@/components/ui/button/Button.vue'
import Card from '@/components/ui/card/Card.vue'
import CardFooter from '@/components/ui/card/CardFooter.vue'
import CardHeader from '@/components/ui/card/CardHeader.vue'

import ContentDivider from './ContentDivider.vue'
import LoadingOverlay from './LoadingOverlay.vue'
import NoResultsPlaceholder from './NoResultsPlaceholder.vue'

it('shows loading feedback during a card action and restores its empty-state action when complete', async () => {
  const loading = ref(false)
  render(
    {
      components: {
        Card,
        CardHeader,
        CardFooter,
        CardContainer,
        CardTop,
        CardBottom,
        ButtonGroup,
        Button,
        ComfyLogo,
        PuzzleIcon,
        VerifiedIcon,
        Loader,
        ContentDivider,
        LoadingOverlay,
        NoResultsPlaceholder
      },
      setup: () => ({ loading }),
      template: `
      <Card>
        <CardHeader><ComfyLogo aria-hidden="true" /><h2>Library</h2></CardHeader>
        <CardContainer>
          <template #top><CardTop>
            <LoadingOverlay :loading="loading" loading-message="Fetching items">
              <Loader />
            </LoadingOverlay>
            <template #top-right><VerifiedIcon aria-hidden="true" /></template>
          </CardTop></template>
          <template #bottom><CardBottom>
            <NoResultsPlaceholder v-if="!loading" message="No items" button-label="Refresh" @action="loading = true" />
          </CardBottom></template>
        </CardContainer>
        <ContentDivider />
        <CardFooter><ButtonGroup aria-label="Library actions">
          <Button :disabled="!loading" @click="loading = false"><PuzzleIcon aria-hidden="true" />Cancel</Button>
        </ButtonGroup></CardFooter>
      </Card>
    `
    },
    {
      global: {
        plugins: [
          createI18n({
            legacy: false,
            locale: 'en',
            messages: { en: { g: { loading: 'Loading' } } }
          })
        ]
      }
    }
  )
  expect(screen.getByRole('heading', { name: 'Library' })).toBeVisible()
  expect(screen.queryByTestId('loading-overlay')).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Refresh' }))
  expect(screen.getByTestId('loading-overlay')).toHaveTextContent(
    'Fetching items'
  )
  expect(screen.getByRole('status')).toHaveTextContent('Loading')
  expect(
    screen.queryByRole('button', { name: 'Refresh' })
  ).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
  await waitFor(() =>
    expect(screen.queryByTestId('loading-overlay')).not.toBeInTheDocument()
  )
  expect(screen.getByRole('button', { name: 'Refresh' })).toBeVisible()
  expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
})

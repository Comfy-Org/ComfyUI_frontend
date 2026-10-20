import type { APIRoute } from 'astro'

import { creatorPaths } from '@/config/hub-creators'
import type { HubCreator } from '@/lib/hub/creators'
import {
  FIRST_WORKFLOW_PAGE,
  creatorWorkflowTemplate
} from '@/lib/hub/creators'

export const getStaticPaths = creatorPaths

export const GET: APIRoute<{ creator: HubCreator }> = ({ props }) =>
  Response.json(
    props.creator.workflows
      .slice(FIRST_WORKFLOW_PAGE)
      .map(creatorWorkflowTemplate)
  )

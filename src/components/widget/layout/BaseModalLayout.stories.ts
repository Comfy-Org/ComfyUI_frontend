import { t } from '@/i18n'
import type { Meta
, StoryObj } from '@storybook/vue3-vite'
impo
rt { computed, provide, ref } from 'vue'

imp
ort Button from '@/components/ui/button/Butto
n.vue'
import MoreButton from '@/components/b
utton/MoreButton.vue'
import CardBottom from 
'@/components/card/CardBottom.vue'
import Car
dContainer from '@/components/card/CardContai
ner.vue'
import CardTop from '@/components/ca
rd/CardTop.vue'
import Tag from '@/components
/chip/Tag.vue'
import MultiSelect from '@/com
ponents/ui/multi-select/MultiSelect.vue'
impo
rt SearchInput from '@/components/ui/search-i
nput/SearchInput.vue'
import SingleSelect fro
m '@/components/ui/single-select/SingleSelect
.vue'
import type { NavGroupData, NavItemData
 } from '@/types/navTypes'
import { OnCloseKe
y } from '@/types/widgetTypes'
import { creat
eGridStyle } from '@/utils/gridUtil'

import 
LeftSidePanel from '../panel/LeftSidePanel.vu
e'
import BaseModalLayout from './BaseModalLa
yout.vue'

interface StoryArgs {
  contentTit
le: string
  hasLeftPanel: boolean
  hasRight
Panel: boolean
  hasHeader: boolean
  hasCont
entFilter: boolean
  hasHeaderRightArea: bool
ean
  cardCount: number
}

const meta: Meta<S
toryArgs> = {
  title: 'Components/Widget/Lay
out/BaseModalLayout',
  argTypes: {
    conte
ntTitle: {
      control: 'text',
      descr
iption: 'Title shown when no left panel is pr
esent'
    },
    hasLeftPanel: {
      contr
ol: 'boolean',
      description: 'Toggle lef
t panel visibility'
    },
    hasRightPanel:
 {
      control: 'boolean',
      descriptio
n: 'Toggle right panel visibility'
    },
   
 hasHeader: {
      control: 'boolean',
     
 description: 'Toggle header visibility'
    
},
    hasContentFilter: {
      control: 'bo
olean',
      description: 'Toggle content fi
lter visibility'
    },
    hasHeaderRightAre
a: {
      control: 'boolean',
      descript
ion: 'Toggle header right area visibility'
  
  },
    cardCount: {
      control: { type: 
'range', min: 0, max: 50, step: 1 },
      de
scription: 'Number of cards to display in con
tent'
    }
  }
}

export default meta
type S
tory = StoryObj<typeof meta>

const createSto
ryTemplate = (args: StoryArgs) => ({
  compon
ents: {
    BaseModalLayout,
    LeftSidePane
l,
    SearchInput,
    MultiSelect,
    Sing
leSelect,
    Button,
    MoreButton,
    Car
dContainer,
    CardTop,
    CardBottom,
    
Tag
  },
  setup() {
    const onClose = () => {
      // OnClose handler for story
    }
    provide(OnCloseKey, onClose)

    const tempNavigation = ref<(NavItemData | NavGroupData)[]>([
      {
        id: 'installed',
        label: t('g.installed'),
        icon: 'icon-[lucide--folder]'
      },
      {
        title: t('g.tags'),
        items: [
          {
            id: 'tag-sd15',
            label: t('g.sd_1_5'),
            icon: 'icon-[lucide--tag]'
          },
          {
            id: 'tag-sdxl',
            label: t('g.sdxl'),
            icon: 'icon-[lucide--tag]'
          },
          {
            id: 'tag-utility',
            label: t('g.utility'),
            icon: 'icon-[lucide--tag]'
          }
        ]
      },
      {
        title: t('g.categories'),
        items: [
          {
            id: 'cat-models',
            label: t('g.models'),
            icon: 'icon-[lucide--layers]'
          },
          {
            id: 'cat-nodes',
            label: t('g.nodes'),
            icon: 'icon-[lucide--grid-3x3]'
          }
        ]
      }
    ])
    c
onst selectedNavItem = ref<string | null>('in
stalled')

    const searchQuery = ref<string
>('')

    const frameworkOptions = ref([
   
   { name: 'Vue', value: 'vue' },
      { nam
e: 'React', value: 'react' },
      { name: '
Angular', value: 'angular' },
      { name: '
Svelte', value: 'svelte' }
    ])
    const p
rojectOptions = ref([
      { name: 'Project 
A', value: 'proj-a' },
      { name: 'Project
 B', value: 'proj-b' },
      { name: 'Projec
t C', value: 'proj-c' }
    ])
    const sort
Options = ref([
      { name: 'Popular', valu
e: 'popular' },
      { name: 'Latest', value
: 'latest' },
      { name: 'A → Z', value:
 'az' }
    ])

    const selectedFrameworks 
= ref<string[]>([])
    const selectedProject
s = ref<string[]>([])
    const selectedSort 
= ref<string>('popular')

    const gridStyle
 = computed(() => createGridStyle())

    ret
urn {
      args,
      t,
      tempNavigati
on,
      selectedNavItem,
      searchQuery,

      frameworkOptions,
      projectOptions
,
      sortOptions,
      selectedFrameworks
,
      selectedProjects,
      selectedSort,

      gridStyle
    }
  },
  template: `
   
 <div>
      <BaseModalLayout v-if="!args.has
RightPanel" :content-title="args.contentTitle
 || 'Content Title'">
        <!-- Left Panel
 Header Title -->
        <template v-if="arg
s.hasLeftPanel" #leftPanelHeaderTitle>
      
    <i class="icon-[lucide--puzzle] size-4 te
xt-neutral" />
          <span class="text-ne
utral text-base">Title</span>
        </templ
ate>

        <!-- Left Panel -->
        <te
mplate v-if="args.hasLeftPanel" #leftPanel>
 
         <LeftSidePanel v-model="selectedNavI
tem" :nav-items="tempNavigation" />
        <
/template>

        <!-- Header -->
        <
template v-if="args.hasHeader" #header>
     
     <SearchInput
            class="max-w-[3
84px]"
            size="lg"
            :mod
elValue="searchQuery"
            @update:mod
elValue="searchQuery = $event"
          />
 
       </template>

        <!-- Header Right
 Area -->
        <template v-if="args.hasHea
derRightArea" #header-right-area>
          <
div class="flex gap-2">
            <Button v
ariant="primary" @click="() => {}">
         
       <i class="icon-[lucide--upload] size-3
" />
              <span> Upload Model </span
>
            </Button>

            <MoreBut
ton>
              <template #default="{ clos
e }">
                <Button
               
   variant="secondary"
                  labe
l="Settings"
                  @click="() => 
{ close() }"
                >
              
    <template #icon>
                    <i c
lass="icon-[lucide--download] size-3" />
    
              </template>
                </B
utton>

                <Button
             
     variant="primary"
                  labe
l="Profile"
                  @click="() => {
 close() }"
                >
               
   <template #icon>
                    <i cl
ass="icon-[lucide--scroll] size-3" />
       
           </template>
                </Butt
on>
              </template>
            </M
oreButton>
          </div>
        </templat
e>

        <!-- Content Filter -->
        <
template v-if="args.hasContentFilter" #conten
tFilter>
          <div class="relative px-6 
py-4 flex gap-2">
            <MultiSelect
  
            v-model="selectedFrameworks"
    
          label="Select Frameworks"
         
     :options="frameworkOptions"
            
  :has-search-box="true"
              :show-
selected-count="true"
              :has-clea
r-button="true"
            />
            <M
ultiSelect
              v-model="selectedPro
jects"
              label="Select Projects"

              :options="projectOptions"
     
       />
            <SingleSelect
         
     v-model="selectedSort"
              lab
el="Sorting Type"
              :options="sor
tOptions"
              class="w-[135px]"
   
         >
              <template #icon>
   
             <i class="icon-[lucide--filter] 
size-3" />
              </template>
        
    </SingleSelect>
          </div>
        
</template>

        <!-- Content -->
       
 <template #content>
          <div :style="g
ridStyle">
            <CardContainer
       
       v-for="i in args.cardCount"
          
    :key="i"
              ratio="square"
   
         >
              <template #top>
    
            <CardTop ratio="landscape">
     
             <template #default>
            
        <div class="w-full h-full bg-blue-500
"></div>
                  </template>
      
            <template #top-right>
           
         <Button size="icon" class="!bg-white
 !text-neutral-900" @click="() => {}">
      
                <i class="icon-[lucide--info]
 size-4" />
                    </Button>
   
               </template>
                  
<template #bottom-right>
                    
<Tag label="png" />
                    <Tag 
label="1.2 MB" />
                    <Tag la
bel="LoRA">
                      <template #
icon>
                        <i class="icon-
[lucide--folder] size-3" />
                 
     </template>
                    </Tag>
 
                 </template>
                
</CardTop>
              </template>
        
      <template #bottom>
                <Car
dBottom />
              </template>
        
    </CardContainer>
          </div>
       
 </template>
      </BaseModalLayout>

      
<BaseModalLayout v-else :content-title="args.
contentTitle || 'Content Title'">
        <!-
- Same content but WITH right panel -->
     
   <!-- Left Panel Header Title -->
        <
template v-if="args.hasLeftPanel" #leftPanelH
eaderTitle>
          <i class="icon-[lucide-
-puzzle] size-4 text-neutral" />
          <s
pan class="text-neutral text-base">Title</spa
n>
        </template>

        <!-- Left Pan
el -->
        <template v-if="args.hasLeftPa
nel" #leftPanel>
          <LeftSidePanel v-m
odel="selectedNavItem" :nav-items="tempNaviga
tion" />
        </template>

        <!-- He
ader -->
        <template v-if="args.hasHead
er" #header>
          <SearchInput
         
   class="max-w-[384px]"
            size="lg
"
            :modelValue="searchQuery"
     
       @update:modelValue="searchQuery = $eve
nt"
          />
        </template>

       
 <!-- Header Right Area -->
        <template
 v-if="args.hasHeaderRightArea" #header-right
-area>
          <div class="flex gap-2">
   
         <Button variant="primary" @click="()
 => {}">
                <i class="icon-[luci
de--upload] size-3" />
                <span>
Upload Model</span>
            </Button>

  
          <MoreButton>
              <templat
e #default="{ close }">
                <Butt
on
                  variant="secondary"
    
              @click="() => { close() }"
    
            >
                    <i class="i
con-[lucide--download] size-3" />
           
         <span>Settings</span>
              
  </Button>

                <Button
        
          variant="primary"
                 
 @click="() => { close() }"
                >

                    <i class="icon-[lucide--
scroll] size-3" />
                    <span>
Profile</span>
                </Button>
    
          </template>
            </MoreButto
n>
          </div>
        </template>

    
    <!-- Content Filter -->
        <template
 v-if="args.hasContentFilter" #contentFilter>

          <div class="relative px-6 py-4 fle
x gap-2">
            <MultiSelect
          
    v-model="selectedFrameworks"
            
  label="Select Frameworks"
              :op
tions="frameworkOptions"
            />
     
       <MultiSelect
              v-model="se
lectedProjects"
              label="Select P
rojects"
              :options="projectOptio
ns"
            />
            <SingleSelect

              v-model="selectedSort"
        
      label="Sorting Type"
              :opt
ions="sortOptions"
              class="w-[13
5px]"
            >
              <template #
icon>
                <i class="icon-[lucide-
-filter] size-3" />
              </template>

            </SingleSelect>
          </div>

        </template>

        <!-- Content --
>
        <template #content>
          <div 
:style="gridStyle">
            <CardContaine
r
              v-for="i in args.cardCount"
 
             :key="i"
              ratio="sq
uare"
            >
              <template #
top>
                <CardTop ratio="landscap
e">
                  <template #default>
   
                 <div class="w-full h-full bg
-blue-500"></div>
                  </templat
e>
                  <template #top-right>
  
                  <Button size="icon" class="
!bg-white !text-neutral-900" @click="() => {}
">
                      <i class="icon-[luci
de--info] size-4" />
                    </Bu
tton>
                  </template>
         
         <template #bottom-right>
           
         <Tag label="png" />
                
    <Tag label="1.2 MB" />
                  
  <Tag label="LoRA">
                      <t
emplate #icon>
                        <i cla
ss="icon-[lucide--folder] size-3" />
        
              </template>
                   
 </Tag>
                  </template>
       
         </CardTop>
              </template>

              <template #bottom>
           
     <CardBottom />
              </template>

            </CardContainer>
          </div
>
        </template>

        <!-- Right Pan
el - Only when hasRightPanel is true -->
    
    <template #rightPanel>
          <div cla
ss="size-full bg-modal-panel-background pr-6 
pb-8 pl-4"></div>
        </template>
      <
/BaseModalLayout>
    </div>
  `
})

export c
onst Default: Story = {
  render: (args: Stor
yArgs) => createStoryTemplate(args),
  args: 
{
    contentTitle: 'Content Title',
    hasL
eftPanel: true,
    hasRightPanel: true,
    
hasHeader: true,
    hasContentFilter: true,

    hasHeaderRightArea: true,
    cardCount: 
12
  }
}

export const BothPanels: Story = {

  render: (args: StoryArgs) => createStoryTem
plate(args),
  args: {
    contentTitle: 'Con
tent Title',
    hasLeftPanel: true,
    hasR
ightPanel: true,
    hasHeader: true,
    has
ContentFilter: true,
    hasHeaderRightArea: 
true,
    cardCount: 12
  }
}

export const L
eftPanelOnly: Story = {
  render: (args: Stor
yArgs) => createStoryTemplate(args),
  args: 
{
    contentTitle: 'Content Title',
    hasL
eftPanel: true,
    hasRightPanel: false,
   
 hasHeader: true,
    hasContentFilter: true,

    hasHeaderRightArea: true,
    cardCount:
 12
  }
}

export const RightPanelOnly: Story
 = {
  render: (args: StoryArgs) => createSto
ryTemplate(args),
  args: {
    contentTitle:
 'Content Title',
    hasLeftPanel: false,
  
  hasRightPanel: true,
    hasHeader: true,
 
   hasContentFilter: true,
    hasHeaderRight
Area: true,
    cardCount: 12
  }
}

export c
onst NoPanels: Story = {
  render: (args: Sto
ryArgs) => createStoryTemplate(args),
  args:
 {
    contentTitle: 'Content Title',
    has
LeftPanel: false,
    hasRightPanel: false,
 
   hasHeader: true,
    hasContentFilter: tru
e,
    hasHeaderRightArea: true,
    cardCoun
t: 12
  }
}

export const MinimalLayout: Stor
y = {
  render: (args: StoryArgs) => createSt
oryTemplate(args),
  args: {
    contentTitle
: 'Simple Content',
    hasLeftPanel: false,

    hasRightPanel: false,
    hasHeader: fals
e,
    hasContentFilter: false,
    hasHeader
RightArea: false,
    cardCount: 6
  }
}

exp
ort const NoContent: Story = {
  render: (arg
s: StoryArgs) => createStoryTemplate(args),
 
 args: {
    contentTitle: 'Empty State',
   
 hasLeftPanel: true,
    hasRightPanel: true,

    hasHeader: true,
    hasContentFilter: t
rue,
    hasHeaderRightArea: true,
    cardCo
unt: 0
  }
}

export const HeaderOnly: Story 
= {
  render: (args: StoryArgs) => createStor
yTemplate(args),
  args: {
    contentTitle: 
'Header Layout',
    hasLeftPanel: false,
   
 hasRightPanel: false,
    hasHeader: true,
 
   hasContentFilter: false,
    hasHeaderRigh
tArea: true,
    cardCount: 8
  }
}

export c
onst FilterOnly: Story = {
  render: (args: S
toryArgs) => createStoryTemplate(args),
  arg
s: {
    contentTitle: 'Filter Layout',
    h
asLeftPanel: false,
    hasRightPanel: false,

    hasHeader: false,
    hasContentFilter: 
true,
    hasHeaderRightArea: false,
    card
Count: 8
  }
}

export const MaxContent: Stor
y = {
  render: (args: StoryArgs) => createSt
oryTemplate(args),
  args: {
    contentTitle
: 'Full Content',
    hasLeftPanel: true,
   
 hasRightPanel: true,
    hasHeader: true,
  
  hasContentFilter: true,
    hasHeaderRightA
rea: true,
    cardCount: 50
  }
}



// @ts-strict-ignore
import { api } from '../api'
import { $el } from '../ui'
import { createSpinner } from './spinner'
import './userSelection.css'

interface SelectedUser {
  username: string
  userId: string
  created: boolean
}

export class UserSelectionScreen {
  async show(users, user): Promise<SelectedUser> {
    const userSelection = document.getElementById('comfy-user-selection')
    userSelection.style.display = ''
    return new Promise((resolve) => {
      const input = userSelection.getElementsByTagName('input')[0]
      const select = userSelection.getElementsByTagName('select')[0]
      const inputSection = input.closest('section')
      const selectSection = select.closest('section')
      const form = userSelection.getElementsByTagName('form')[0]
      const error = userSelection.getElementsByClassName('comfy-user-error')[0]
      const button = userSelection.getElementsByClassName(
        'comfy-user-button-next'
      )[0]

      let inputActive = null
      input.addEventListener('focus', () => {
        inputSection.classList.add('selected')
        selectSection.classList.remove('selected')
        inputActive = true
      })
      select.addEventListener('focus', () => {
        inputSection.classList.remove('selected')
        selectSection.classList.add('selected')
        inputActive = false
        select.style.color = ''
      })
      select.addEventListener('blur', () => {
        if (!select.value) {
          select.style.color = 'var(--descrip-text)'
        }
      })

      form.addEventListener('submit', async (e) => {
        e.preventDefault()
        if (inputActive == null) {
          error.textContent =
            'Please enter a username or select an existing user.'
        } else if (inputActive) {
          const username = input.value.trim()
          if (!username) {
            error.textContent = 'Please enter a username.'
            return
          }

          // Create new user
          // Property 'readonly' does not exist on type 'HTMLSelectElement'.ts(2339)
          // Property 'readonly' does not exist on type 'HTMLInputElement'. Did you mean 'readOnly'?ts(2551)
          input.disabled =
            select.disabled =
            // @ts-expect-error
            input.readonly =
            // @ts-expect-error
            select.readonly =
              true
          const spinner = createSpinner()
          button.prepend(spinner)
          try {
            const resp = await api.createUser(username)
            if (resp.status >= 300) {
              let message =
                'Error creating user: ' + resp.status + ' ' + resp.statusText
              try {
                const res = await resp.json()
                if (res.error) {
                  message = res.error
                }
              } catch (error) {}
              throw new Error(message)
            }

            resolve({ username, userId: await resp.json(), created: true })
          } catch (err) {
            spinner.remove()
            error.textContent =
              err.message ??
              err.statusText ??
              err ??
              'An unknown error occurred.'
            // Property 'readonly' does not exist on type 'HTMLSelectElement'.ts(2339)
            // Property 'readonly' does not exist on type 'HTMLInputElement'. Did you mean 'readOnly'?ts(2551)
            input.disabled =
              select.disabled =
              // @ts-expect-error
              input.readonly =
              // @ts-expect-error
              select.readonly =
                false
            return
          }
        } else if (!select.value) {
          error.textContent = 'Please select an existing user.'
          return
        } else {
          resolve({
            username: users[select.value],
            userId: select.value,
            created: false
          })
        }
      })

      if (user) {
        const name = localStorage['Comfy.userName']
        if (name) {
          input.value = name
        }
      }
      if (input.value) {
        // Focus the input, do this separately as sometimes browsers like to fill in the value
        input.focus()
      }

      const userIds = Object.keys(users ?? {})
      if (userIds.length) {
        for (const u of userIds) {
          $el('option', { textContent: users[u], value: u, parent: select })
        }
        select.style.color = 'var(--descrip-text)'

        if (select.value) {
          // Focus the select, do this separately as sometimes browsers like to fill in the value
          select.focus()
        }
      } else {
        userSelection.classList.add('no-users')
        input.focus()
      }
    }).then((r: SelectedUser) => {
      userSelection.remove()
      return r
    })
  }
}

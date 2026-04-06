import satori from 'satori'
import { Resvg } from '@resvg/resvg-js'
import sharp from 'sharp'
import type { SatoriOptions } from 'satori'

const WIDTH = 1200
const HEIGHT = 630

// Module-scoped font cache
let fontsPromise: Promise<SatoriOptions['fonts']> | null = null

async function loadFonts(): Promise<SatoriOptions['fonts']> {
  if (fontsPromise) return fontsPromise
  fontsPromise = (async () => {
    const [regular, bold] = await Promise.all([
      fetch(
        'https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfMZg.ttf'
      ).then((r) => r.arrayBuffer()),
      fetch(
        'https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuFuYMZg.ttf'
      ).then((r) => r.arrayBuffer())
    ])
    return [
      {
        name: 'Inter',
        data: regular,
        weight: 400 as const,
        style: 'normal' as const
      },
      {
        name: 'Inter',
        data: bold,
        weight: 700 as const,
        style: 'normal' as const
      }
    ]
  })()
  return fontsPromise
}

// Comfy Hub logo SVG inlined as base64 data URI (avoids fs.readFileSync in serverless)
const LOGO_DATA_URI =
  'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjExLjUiIGhlaWdodD0iNTIuNSIgdmlld0JveD0iMCAwIDE0MSAzNSIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyOC43OTcgMzQuMkwxMzIuMDEzIDIzSDEzNi43NDlDMTM5LjE5NyAyMyAxNDAuNDQ1IDI0LjE4NCAxNDAuNDQ1IDI1LjY4OEMxNDAuNDQ1IDI3LjI0IDEzOS4yNDUgMjguMTg0IDEzNy42NDUgMjguNDg4QzEzOC45ODkgMjguODcyIDEzOS42NDUgMjkuNzg0IDEzOS42NDUgMzAuODU2QzEzOS42NDUgMzMuMzY4IDEzNy4yMTMgMzQuMiAxMzQuMzE3IDM0LjJIMTI4Ljc5N1pNMTMyLjQ2MSAzMi4wODhIMTM0LjMxN0MxMzUuNzI1IDMyLjA4OCAxMzYuNTU3IDMxLjU5MiAxMzYuNTU3IDMwLjUyQzEzNi41NTcgMjkuODggMTM2LjEwOSAyOS40MzIgMTM1LjE2NSAyOS40MTZIMTMzLjIxM0wxMzIuNDYxIDMyLjA4OFpNMTMzLjc3MyAyNy40OEgxMzUuNTAxQzEzNi43NDkgMjcuNDggMTM3LjQ4NSAyNy4wMTYgMTM3LjQ4NSAyNi4xMzZDMTM3LjQ4NSAyNS41NiAxMzcuMTAxIDI1LjExMiAxMzYuMDI5IDI1LjExMkgxMzQuNDYxTDEzMy43NzMgMjcuNDhaIiBmaWxsPSIjRUNGRjAwIi8+CjxwYXRoIGQ9Ik0xMjIuNTMxIDM0LjQ3MkMxMTkuNTU1IDM0LjQ3MiAxMTcuNDkxIDMyLjYzMiAxMTguNTMxIDI5TDEyMC4yNTkgMjNIMTIzLjMxNUwxMjEuNDQzIDI5LjUyOEMxMjAuODk5IDMxLjM4NCAxMjEuNzc5IDMyLjAyNCAxMjIuODUxIDMyLjAyNEMxMjMuOTA3IDMyLjAyNCAxMjQuNjkxIDMxLjM4NCAxMjUuMTM5IDI5LjgxNkwxMjcuMDkxIDIzSDEyOS45NTVMMTI3Ljg5MSAzMC4yMTZDMTI3LjEyMyAzMi44NzIgMTI1LjI5OSAzNC40NzIgMTIyLjUzMSAzNC40NzJaIiBmaWxsPSIjRUNGRjAwIi8+CjxwYXRoIGQ9Ik0xMTIuMDA4IDM0LjJMMTEzLjMyIDI5LjY0SDEwOS4zNjhMMTA4LjA1NiAzNC4ySDEwNUwxMDguMjE2IDIzSDExMS4yNzJMMTEwLjA0IDI3LjMwNEgxMTMuOTkyTDExNS4yMjQgMjNIMTE4LjI2NEwxMTUuMDQ4IDM0LjJIMTEyLjAwOFoiIGZpbGw9IiNFQ0ZGMDAiLz4KPHBhdGggZD0iTTg3Ljg5MDcgMjkuMjE4M0M4Ny4zMjA1IDI5LjIxODMgODYuODYwNSAyOS4wMDgxIDg2LjU2MDcgMjguNjEwMkM4Ni4yNTI0IDI4LjIwMSA4Ni4xNzIgMjcuNjMwMiA4Ni4zNDAyIDI3LjA0NDFMODcuMzc5NyAyMy40MTg5Qzg3LjcyMzIgMjIuMjIwMiA4OC45NzgxIDIxLjI0NSA5MC4xNzcxIDIxLjI0NUg5Mi41MDc3QzkyLjc4NDggMjEuMjQ1IDkzLjAyODUgMjEuMDYxNSA5My4xMDQ4IDIwLjc5NTJMOTMuNTA2OCAxOS4zOTMzQzkzLjU2MDYgMTkuMjA1NSA5My41MjMyIDE5LjAwMzggOTMuNDA1OCAxOC44NDc5QzkzLjI4ODQgMTguNjkyMyA5My4xMDQ2IDE4LjYwMDcgOTIuOTA5NiAxOC42MDA3TDg3LjgwMjMgMTguNjAxNkM4Ny43NzM2IDE4LjU5NzYgODcuNzQ2OSAxOC41OTU4IDg3LjcxNzggMTguNTk1OEg4NS45OTcxQzg1LjQyNjkgMTguNTk1OCA4NC45NjY5IDE4LjM4NTYgODQuNjY3MSAxNy45ODc2Qzg0LjM1ODkgMTcuNTc4NSA4NC4yNzgzIDE3LjAwNzYgODQuNDQ2NCAxNi40MjE5TDg0LjY0NyAxNS43MjE5Qzg0LjcwMDcgMTUuNTM0NCA4NC42NjMzIDE1LjMzMjcgODQuNTQ1OSAxNS4xNzY4Qzg0LjQyODUgMTUuMDIxMiA4NC4yNDQ5IDE0LjkyOTYgODQuMDQ5OCAxNC45Mjk2SDgzLjM5MDdDODMuMTEzNCAxNC45Mjk2IDgyLjg2OTkgMTUuMTEzMSA4Mi43OTM2IDE1LjM3OTdMODIuNDk0OCAxNi40MjE5QzgyLjE1MTIgMTcuNjIwNiA4MC44OTYyIDE4LjU5NTggNzkuNjk3MiAxOC41OTU4SDc3LjM3MjVDNzcuMDk1OSAxOC41OTU4IDc2Ljg1MjUgMTguNzc4NyA3Ni43NzU4IDE5LjA0NDRMNzYuMTE1MSAyMS4zMzA1Qzc2LjExMjIgMjEuMzM5MyA3Ni4xMDQ2IDIxLjM2MjcgNzYuMTAyMiAyMS4zNzE1TDc1LjE1OTEgMjQuNjM4MkM3NS4xNTUgMjQuNjQ5NCA3NS4xNDkyIDI0LjY2NzMgNzUuMTQ2IDI0LjY3ODlMNzQuNDYzNyAyNy4wNDM1Qzc0LjExOTkgMjguMjQzMSA3Mi44NjQ5IDI5LjIxODMgNzEuNjY1OSAyOS4yMTgzSDY4LjA0MDhDNjcuNDcwNiAyOS4yMTgzIDY3LjAxMDYgMjkuMDA4MSA2Ni43MTA3IDI4LjYxMDJDNjYuNDAyNCAyOC4yMDEzIDY2LjMyMiAyNy42MzA1IDY2LjQ5MDEgMjcuMDQ0NUw2OS41Mjg0IDE2LjUwNTRDNjkuNTMyMiAxNi40OTQ0IDY5LjUzOTIgMTYuNDcyNiA2OS41NDI1IDE2LjQ2MTRMNjkuNzU0OSAxNS43MjI1QzY5LjgwODggMTUuNTM1MSA2OS43NzE1IDE1LjMzMzEgNjkuNjU0MiAxNS4xNzcxQzY5LjUzNjggMTUuMDIxMiA2OS4zNTMgMTQuOTI5NiA2OS4xNTc5IDE0LjkyOTZINjguNTA1NUM2OC4yMjg3IDE0LjkyOTYgNjcuOTg1NCAxNS4xMTI4IDY3LjkwODcgMTUuMzc4NUw2Ni41ODYxIDE5Ljk2MTRDNjYuNTgyMSAxOS45NzI2IDY2LjU3NjQgMTkuOTkwOCA2Ni41NzMyIDIwLjAwMkw2Ni4wNzQxIDIxLjczMThDNjUuNzMwMyAyMi45MzE4IDY0LjQ3NTMgMjMuOTA3MiA2My4yNzY0IDIzLjkwNzJINTkuNjUxM0M1OS4wODA5IDIzLjkwNzIgNTguNjIwOSAyMy42OTcgNTguMzIxMSAyMy4yOTkxQzU4LjAxMjkgMjIuODg5NiA1Ny45MzI0IDIyLjMxODggNTguMTAwNiAyMS43MzMxTDYwLjMwMzUgMTQuMDg0NkM2MC4zNTc0IDEzLjg5NzEgNjAuMzIwMSAxMy42OTUxIDYwLjIwMjkgMTMuNTM4OUM2MC4wODU1IDEzLjM4MyA1OS45MDE3IDEzLjI5MTQgNTkuNzA2NSAxMy4yOTE0SDU5LjA1MDJDNTguNzczMSAxMy4yOTE0IDU4LjUyOTUgMTMuNDc0OSA1OC40NTMxIDEzLjc0MTJMNTcuNTEzOSAxNy4wMTE5QzU3LjUxMDEgMTcuMDIyOCA1Ny41MDQzIDE3LjA0MDcgNTcuNTAxMSAxNy4wNTE5TDU2LjE0OTQgMjEuNzMxOEM1NS44MDUxIDIyLjkzMTggNTQuNTUwMSAyMy45MDcyIDUzLjM1MTQgMjMuOTA3Mkg0OS43MjYzQzQ5LjE1NjEgMjMuOTA3MiA0OC42OTYxIDIzLjY5NyA0OC4zOTYzIDIzLjI5OTFDNDguMDg3OSAyMi44ODk5IDQ4LjAwNzUgMjIuMzE5MSA0OC4xNzU2IDIxLjczMzFMNDkuMjE1MSAxOC4xMDc4QzQ5LjIxOSAxOC4wOTY5IDQ5LjIyNDcgMTguMDc5NiA0OS4yMjc4IDE4LjA2ODNMNTAuMzgwMyAxNC4wNzgyQzUwLjQzNDQgMTMuODkwNyA1MC4zOTczIDEzLjY4ODQgNTAuMjggMTMuNTMyNUM1MC4xNjI2IDEzLjM3NjYgNDkuOTc4NyAxMy4yODQ3IDQ5Ljc4MzUgMTMuMjg0N0g0OS4xMzMzQzQ4Ljg1NjUgMTMuMjg0NyA0OC42MTMzIDEzLjQ2NzkgNDguNTM2NSAxMy43MzM2TDQ4LjQ0MjMgMTQuMDZDNDguNDM5IDE0LjA2OTQgNDguNDMxOSAxNC4wOTE1IDQ4LjQyOTEgMTQuMTAwOUw0Ni4zMDk2IDIxLjQzNjdDNDYuMzA2NCAyMS40NDY0IDQ2LjI5ODYgMjEuNDcgNDYuMjk1OSAyMS40Nzk4TDQ2LjIyMzYgMjEuNzM0MkM0NS44ODAyIDIyLjkzMTcgNDQuNjI1MyAyMy45MDcyIDQzLjQyNjQgMjMuOTA3MkgzOS44MDEzQzM5LjIzMSAyMy45MDcyIDM4Ljc3MSAyMy42OTcgMzguNDcxMiAyMy4yOTkxQzM4LjE2MjkgMjIuODg5OSAzOC4wODI1IDIyLjMxOSAzOC4yNTA2IDIxLjczM0wzOC40NTAzIDIxLjAzNkMzOC41MDQyIDIwLjg0ODYgMzguNDY2NyAyMC42NDY5IDM4LjM0OTMgMjAuNDkwOUMzOC4yMzE5IDIwLjMzNTMgMzguMDQ4MyAyMC4yNDM3IDM3Ljg1MzIgMjAuMjQzN0gzNy4xOTYzQzM2LjkxOTYgMjAuMjQzNyAzNi42NzYyIDIwLjQyNjYgMzYuNTk5NSAyMC42OTI2TDM2LjI5OTMgMjEuNzMxOEMzNS45NTUyIDIyLjkzMTcgMzQuNzAwMyAyMy45MDcyIDMzLjUwMTQgMjMuOTA3MkgzMS4xNTJDMzAuODc0OSAyMy45MDcyIDMwLjYzMTIgMjQuMDkwNyAzMC41NTQ5IDI0LjM1N0wyOS43ODQzIDI3LjA0NDFDMjkuNDQwOCAyOC4yNDMxIDI4LjE4NTggMjkuMjE4MyAyNi45ODY4IDI5LjIxODNIMjMuMzYxN0MyMi43OTE0IDI5LjIxODMgMjIuMzMxNCAyOS4wMDgxIDIyLjAzMTUgMjguNjEwMkMyMS43MjMyIDI4LjIwMSAyMS42NDI4IDI3LjYzMDEgMjEuODExIDI3LjA0NDFMMjIuNDgzMiAyNC42OTk1QzIyLjUzNyAyNC41MTIgMjIuNDk5NSAyNC4zMTAzIDIyLjM4MjIgMjQuMTU0NEMyMi4yNjQ4IDIzLjk5ODggMjIuMDgxMSAyMy45MDcyIDIxLjg4NjEgMjMuOTA3MkgxOS45NTE0QzE5LjM4MTMgMjMuOTA3MiAxOC45MjEzIDIzLjY5NyAxOC42MjEyIDIzLjI5OTFDMTguMzEzIDIyLjg4OTkgMTguMjMyNSAyMi4zMTkgMTguNDAwNSAyMS43MzMzTDE4LjYwMDQgMjEuMDM2QzE4LjY1NDEgMjAuODQ4NiAxOC42MTY2IDIwLjY0NjkgMTguNDk5MyAyMC40OTA5QzE4LjM4MTkgMjAuMzM1MyAxOC4xOTgyIDIwLjI0MzcgMTguMDAzMiAyMC4yNDM3SDE3LjM0NDJDMTcuMDY3MSAyMC4yNDM3IDE2LjgyMzYgMjAuNDI3MiAxNi43NDcxIDIwLjY5MzVMMTYuNDQ5IDIxLjczM0MxNi4xMDUzIDIyLjkzMjEgMTQuODUwMyAyMy45MDcyIDEzLjY1MTUgMjMuOTA3Mkw4LjY4NTk5IDIzLjkxNkw1LjA1MDI2IDIzLjkxNjNDNC40ODAwNCAyMy45MTYzIDQuMDIwMDQgMjMuNzA2MSAzLjcyMDIyIDIzLjMwODJDMy40MTIwNSAyMi44OTkgMy4zMzE1MSAyMi4zMjgxIDMuNDk5NTcgMjEuNzQyNEw0LjE3NDU5IDE5LjM4ODRDNC4yMjg0MiAxOS4yMDA2IDQuMTkwOTYgMTguOTk4OSA0LjA3MzU5IDE4Ljg0M0MzLjk1NjIxIDE4LjY4NzQgMy43NzI1NiAxOC41OTU4IDMuNTc3NSAxOC41OTU4SDEuNjM2NzNDMS4wNjY1IDE4LjU5NTggMC42MDY1MDkgMTguMzg1NiAwLjMwNjY4OSAxNy45ODc2Qy0wLjAwMTQ4NTYgMTcuNTc4NSAtMC4wODIwMjM2IDE3LjAwNzYgMC4wODYwNDA4IDE2LjQyMTlMMS44OTMyMiAxMC4xNDE3QzEuODk2NTUgMTAuMTMyMyAxLjkwNCAxMC4xMDg3IDEuOTA2ODYgMTAuMDk5M0wyLjQ5MDI4IDguMDc2NDRDMi40OTU2IDguMDYxODcgMi41MDAxMyA4LjA0NzYyIDIuNTA0MzkgOC4wMzI3N0wyLjY2MTIxIDcuNDg1MjhDMy4wMDQ4NSA2LjI4NjU2IDQuMjU5NyA1LjMxMTEgNS40NTg1NCA1LjMxMTFINy43ODA2QzguMDU3NjkgNS4zMTExIDguMzAxNDEgNS4xMjc2IDguMzc3NyA0Ljg2MTI5TDkuMTQ1NTYgMi4xODM2QzkuNDg5MjMgMC45ODQ1NjQgMTAuNzQ0MiAwLjAwOTQxMTExIDExLjk0MzIgMC4wMDk0MTExMUwxNi45MTk5IDBIMjAuNTQ0MkMyMS4xMTQ1IDAgMjEuNTc0NSAwLjIxMDIxMyAyMS44NzQzIDAuNjA4MTVDMjIuMTgyNiAxLjAxNzMzIDIyLjI2MyAxLjU4ODE4IDIyLjA5NDkgMi4xNzQxOEwyMS4wNTU1IDUuNzk5NzZDMjAuNzExNyA2Ljk5ODQ4IDE5LjQ1NjcgNy45NzM2MyAxOC4yNTc4IDcuOTczNjNMMTMuMjgxMSA3Ljk4MjczSDEwLjk2QzEwLjY4MzEgNy45ODI3MyAxMC40Mzk1IDguMTY2MjQgMTAuMzYyOSA4LjQzMjI2TDkuMzM5MDYgMTEuOTk1M0M5LjMzNTI3IDEyLjAwNjYgOS4zMjk0OSAxMi4wMjQ1IDkuMzI2MzIgMTIuMDM1N0w4LjQyODA0IDE1LjE0NjVDOC4zNzM3NSAxNS4zMzQzIDguNDExMDUgMTUuNTM2NiA4LjUyODc0IDE1LjY5MjhDOC42NDYxMSAxNS44NDg0IDguODI5NzcgMTUuOTQgOS4wMjQ4MyAxNS45NEM5LjAyNTI5IDE1Ljk0IDEyLjMxMzQgMTUuOTMzNiAxMi4zMTM0IDE1LjkzMzZIMTUuOTM3N0MxNi41MDggMTUuOTMzNiAxNi45NjggMTYuMTQzOCAxNy4yNjc4IDE2LjU0MThDMTcuNTc2MSAxNi45NTEgMTcuNjU2NSAxNy41MjE4IDE3LjQ4ODQgMTguMTA3OEwxNy4yODE0IDE4LjgzMDNDMTcuMjI3NiAxOS4wMTc4IDE3LjI2NSAxOS4yMTk1IDE3LjM4MjQgMTkuMzc1NEMxNy40OTk4IDE5LjUzMSAxNy42ODM1IDE5LjYyMjYgMTcuODc4NSAxOS42MjI2SDE4LjUzNzVDMTguODE0NCAxOS42MjI2IDE5LjA1OCAxOS40MzkxIDE5LjEzNDYgMTkuMTczMUwxOS41MjU0IDE3LjgxMzNDMTkuNTI5MiAxNy44MDIxIDIwLjk3NTMgMTIuNzk3NyAyMC45NzUzIDEyLjc5NzdDMjEuMzE5MiAxMS41OTc3IDIyLjU3NDIgMTAuNjIyNiAyMy43NzMyIDEwLjYyMjZIMjYuMDg3MkMyNi4zNjQzIDEwLjYyMjYgMjYuNjA4IDEwLjQzOTEgMjYuNjg0MyAxMC4xNzI0TDI3LjQ1MjggNy40OTIwMkMyNy43OTY3IDYuMjkzMyAyOS4wNTE5IDUuMzE3ODQgMzAuMjUwNiA1LjMxNzg0SDMzLjg3NTVDMzQuNDQ1OCA1LjMxNzg0IDM0LjkwNTggNS41MjgwNSAzNS4yMDU2IDUuOTI1OTlDMzUuNTEzOSA2LjMzNTE3IDM1LjU5NDQgNi45MDYwMiAzNS40MjY0IDcuNDkxNzFMMzQuNzU1OSA5LjgzMDI5QzM0LjcwMjEgMTAuMDE3NyAzNC43Mzk1IDEwLjIxOTQgMzQuODU2OSAxMC4zNzU0QzM0Ljk3NDMgMTAuNTMxIDM1LjE1NzkgMTAuNjIyNiAzNS4zNTMgMTAuNjIyNkgzNy4zMjM0QzM3Ljg5MzYgMTAuNjIyNiAzOC4zNTM2IDEwLjgzMjggMzguNjUzNCAxMS4yMzA3QzM4Ljk2MTcgMTEuNjM5OSAzOS4wNDIxIDEyLjIxMDcgMzguODczOSAxMi43OTY4TDM3LjEzNzkgMTguODI5N0MzNy4wODM5IDE5LjAxNzIgMzcuMTIxMiAxOS4yMTkyIDM3LjIzODYgMTkuMzc1MUMzNy4zNTU4IDE5LjUzMSAzNy41Mzk2IDE5LjYyMjYgMzcuNzM0OCAxOS42MjI2SDM4LjM4NzZDMzguNjY0MyAxOS42MjI2IDM4LjkwNzcgMTkuNDM5NCAzOC45ODQ1IDE5LjE3MzRMMzkuODAxOCAxNi4zMzhDMzkuODA0NyAxNi4zMjk1IDM5LjgxMTkgMTYuMzA2OCAzOS44MTQ1IDE2LjI5ODNMNDEuOTM0MiA4Ljk2MjI0QzQxLjkzODIgOC45NTA3MSA0MS45NDQxIDguOTMyMiA0MS45NDc0IDguOTIwNjhMNDIuMzYwOSA3LjQ4NjI4QzQyLjcwNDggNi4yODY2NSA0My45NTk4IDUuMzExMTkgNDUuMTU4NyA1LjMxMTE5SDUzLjc0NDFDNTQuMzE0MiA1LjMxMTE5IDU0Ljc3NDIgNS41MjE2OCA1NS4wNzQxIDUuOTE5NjVDNTUuMzgyNSA2LjMyODUyIDU1LjQ2MyA2Ljg5OTM3IDU1LjI5NDkgNy40ODUwNkw1NC42MjI1IDkuODMwMDJDNTQuNTY4NyAxMC4wMTc4IDU0LjYwNjEgMTAuMjE5NSA1NC43MjM1IDEwLjM3NTFDNTQuODQwOSAxMC41MzEgNTUuMDI0NSAxMC42MjI2IDU1LjIxOTYgMTAuNjIyNkg1NS44OTY4QzU2LjE3MzggMTAuNjIyNiA1Ni40MTc2IDEwLjQzOTEgNTYuNDkzOSAxMC4xNzI4TDU3LjI2MjUgNy40OTIwNUM1Ny42MDYzIDYuMjkzMzMgNTguODYxMyA1LjMxNzg3IDYwLjA2MDEgNS4zMTc4N0g2My42ODUyQzY0LjI1NTQgNS4zMTc4NyA2NC43MTU0IDUuNTI4MDggNjUuMDE1MyA1LjkyNjAyQzY1LjMyMzYgNi4zMzUyIDY1LjQwNCA2LjkwNjA1IDY1LjIzNTkgNy40OTIwNUw2NC41NjU2IDkuODMwMzNDNjQuNTExNyAxMC4wMTc4IDY0LjU0OTIgMTAuMjE5NSA2NC42NjY2IDEwLjM3NTRDNjQuNzg0IDEwLjUzMSA2NC45Njc2IDEwLjYyMjYgNjUuMTYyNyAxMC42MjI2SDY3LjA5ODNDNjcuNjY4NSAxMC42MjI2IDY4LjEyODUgMTAuODMyOCA2OC40MjgzIDExLjIzMDdDNjguNzM2NSAxMS42Mzk5IDY4LjgxNyAxMi4yMTA4IDY4LjY0OSAxMi43OTY1TDY4LjQ0MjcgMTMuNTE2M0M2OC4zODg5IDEzLjcwMzcgNjguNDI2MyAxMy45MDU0IDY4LjU0MzcgMTQuMDYxM0M2OC42NjExIDE0LjIxNjkgNjguODQ0NyAxNC4zMDg1IDY5LjAzOTggMTQuMzA4NUg2OS42OTY1QzY5Ljk3MzEgMTQuMzA4NSA3MC4yMTY0IDE0LjEyNTYgNzAuMjkzMyAxMy44NTk5TDcyLjEzNTggNy40ODY2MkM3Mi40Nzk3IDYuMjg2MzcgNzMuNzM0NyA1LjMxMTIyIDc0LjkzMzYgNS4zMTEyMkg3Ny4yNjQxQzc3LjU0MTIgNS4zMTEyMiA3Ny43ODQ4IDUuMTI3NzIgNzcuODYxMiA0Ljg2MTQxTDc4LjYzMTkgMi4xNzQzMUM3OC45NzU2IDAuOTc1Mjc3IDgwLjIzMDYgMC4wMDAxMjQyMzkgODEuNDI5NCAwLjAwMDEyNDIzOUg4NS4wNTQ1Qzg1LjYyNDkgMC4wMDAxMjQyMzkgODYuMDg0OSAwLjIxMDMzNyA4Ni4zODQ3IDAuNjA4Mjc1Qzg2LjY5MyAxLjAxNzQ2IDg2Ljc3MzQgMS41ODgzIDg2LjYwNTIgMi4xNzQzMUw4NS41NjU4IDUuNzk5ODhDODUuMjIyMSA2Ljk5ODYxIDgzLjk2NzEgNy45NzM3NiA4Mi43NjgzIDcuOTczNzZIODAuNDM3NkM4MC4xNjA1IDcuOTczNzYgNzkuOTE2OCA4LjE1NzI2IDc5Ljg0MDUgOC40MjM4OEw3OS40MzcyIDkuODMwMzZDNzkuMzgzNCAxMC4wMTc4IDc5LjQyMDkgMTAuMjE5NSA3OS41MzgyIDEwLjM3NTRDNzkuNjU1NiAxMC41MzEgNzkuODM5MyAxMC42MjI2IDgwLjAzNDMgMTAuNjIyNkg4MS45ODM2QzgyLjU1MzggMTAuNjIyNiA4My4wMTM4IDEwLjgzMjggODMuMzEzNiAxMS4yMzA4QzgzLjYyMiAxMS42Mzk3IDgzLjcwMjQgMTIuMjEwNSA4My41MzQzIDEyLjc5NjVMODMuMzI4IDEzLjUxNjNDODMuMjc0MiAxMy43MDM3IDgzLjMxMTcgMTMuOTA1NCA4My40MjkgMTQuMDYxNEM4My41NDY0IDE0LjIxNyA4My43MzAxIDE0LjMwODYgODMuOTI1MSAxNC4zMDg2SDg0LjU4NDJDODQuODYxIDE0LjMwODYgODUuMTA0MyAxNC4xMjU2IDg1LjE4MSAxMy44NTk2TDg3LjAyMDkgNy40ODY2MkM4Ny4zNjUyIDYuMjg2NjkgODguNjIwMiA1LjMxMTIyIDg5LjgxODkgNS4zMTEyMkg5My40NDQyQzk0LjAxNDQgNS4zMTEyMiA5NC40NzQ0IDUuNTIxNDMgOTQuNzc0MiA1LjkxOTM3Qzk1LjA4MjUgNi4zMjg1NSA5NS4xNjI5IDYuODk5NCA5NC45OTQ3IDcuNDg1NDFMOTMuMzU4MyAxMy4xNzU2QzkzLjM1NDIgMTMuMTg2OSA5My4zNDg2IDEzLjIwNDggOTMuMzQ1MyAxMy4yMTYzTDkzLjE2OTkgMTMuODI1MUM5My4xMTYgMTQuMDEyOCA5My4xNTMxIDE0LjIxNDggOTMuMjcwNSAxNC4zNzA3QzkzLjM4NzkgMTQuNTI2NiA5My41NzE3IDE0LjYxODMgOTMuNzY2OSAxNC42MTgzSDk0LjQxNTNDOTQuNjkyMSAxNC42MTgzIDk0LjkzNTUgMTQuNDM1MSA5NS4wMTIzIDE0LjE2OTNMOTYuOTQwMiA3LjQ4NjY1Qzk3LjI4NDMgNi4yODY3MiA5OC41MzkyIDUuMzExMjUgOTkuNzM4MSA1LjMxMTI1SDEwMy4zNjNDMTAzLjkzMyA1LjMxMTI1IDEwNC4zOTMgNS41MjE3NCAxMDQuNjkzIDUuOTE5NzFDMTA1LjAwMiA2LjMyODU4IDEwNS4wODIgNi44OTk0MyAxMDQuOTE0IDcuNDg1NDRMMTAwLjgwOSAyMS43MzI2QzEwMC40NjUgMjIuOTMyMiA5OS4yMTA1IDIzLjkwNzQgOTguMDExOCAyMy45MDc0SDk1LjY4MTFDOTUuNDA0IDIzLjkwNzQgOTUuMTYwMyAyNC4wOTA5IDk1LjA4NCAyNC4zNTcyTDk0LjMxMzQgMjcuMDQ0M0M5My45Njk4IDI4LjI0MzMgOTIuNzE0OCAyOS4yMTg1IDkxLjUxNTkgMjkuMjE4NUw4Ny44OTA3IDI5LjIxODNaTTI5LjI3NTMgMTMuMjkxNEMyOC45OTg1IDEzLjI5MTQgMjguNzU1MSAxMy40NzQ2IDI4LjY3ODMgMTMuNzQwNkwyNi43NDQyIDIwLjQ1MThDMjYuNjkwMiAyMC42MzkzIDI2LjcyNzQgMjAuODQxMyAyNi44NDQ3IDIwLjk5NzJDMjYuOTYyMSAyMS4xNTM0IDI3LjE0NTkgMjEuMjQ1IDI3LjM0MTEgMjEuMjQ1SDI3Ljk5NzNDMjguMjc0MSAyMS4yNDUgMjguNTE3NSAyMS4wNjE5IDI4LjU5NDMgMjAuNzk1OEwzMC41Mjg0IDE0LjA4NDZDMzAuNTgyNCAxMy44OTcyIDMwLjU0NTIgMTMuNjk1MiAzMC40Mjc5IDEzLjUzOTJDMzAuMzEwNSAxMy4zODMgMzAuMTI2NyAxMy4yOTE0IDI5LjkzMTUgMTMuMjkxNEgyOS4yNzUzWiIgZmlsbD0iI0YwRkY0MSIvPgo8L3N2Zz4K'

async function fetchImageAsDataUri(url: string): Promise<string | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const contentType = res.headers.get('content-type') || 'image/png'
    const raw = Buffer.from(await res.arrayBuffer())
    // satori only supports PNG/JPEG — convert other formats (e.g. WebP)
    const needsConversion =
      !contentType.includes('png') &&
      !contentType.includes('jpeg') &&
      !contentType.includes('jpg')
    const pngBuffer = needsConversion ? await sharp(raw).png().toBuffer() : raw
    const mime = needsConversion ? 'image/png' : contentType
    return `data:${mime};base64,${pngBuffer.toString('base64')}`
  } catch {
    return null
  }
}

function workflowLayout(
  title: string,
  thumbnailDataUri: string | null,
  creatorName?: string
) {
  const logo = LOGO_DATA_URI
  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        width: '100%',
        height: '100%',
        backgroundColor: '#1a1a1a',
        padding: '60px',
        fontFamily: 'Inter'
      },
      children: [
        // Thumbnail
        thumbnailDataUri
          ? {
              type: 'div',
              props: {
                style: {
                  display: 'flex',
                  flexShrink: 0,
                  marginRight: '48px',
                  alignItems: 'center'
                },
                children: [
                  {
                    type: 'img',
                    props: {
                      src: thumbnailDataUri,
                      width: 440,
                      height: 330,
                      style: {
                        borderRadius: '16px',
                        objectFit: 'cover'
                      }
                    }
                  }
                ]
              }
            }
          : null,
        // Text content
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              flex: 1,
              overflow: 'hidden'
            },
            children: [
              {
                type: 'div',
                props: {
                  style: {
                    fontSize: 40,
                    fontWeight: 700,
                    color: '#ffffff',
                    lineHeight: 1.2,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical'
                  },
                  children: title
                }
              },
              creatorName
                ? {
                    type: 'div',
                    props: {
                      style: {
                        fontSize: 24,
                        color: '#888888',
                        marginTop: '16px'
                      },
                      children: `by @${creatorName}`
                    }
                  }
                : null
            ].filter(Boolean)
          }
        },
        // Logo bottom-right
        {
          type: 'img',
          props: {
            src: logo,
            width: 140,
            height: 35,
            style: {
              position: 'absolute',
              bottom: '40px',
              right: '48px'
            }
          }
        }
      ].filter(Boolean)
    }
  }
}

function creatorLayout(
  displayName: string,
  username: string,
  avatarDataUri: string | null
) {
  const logo = LOGO_DATA_URI
  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        width: '100%',
        height: '100%',
        backgroundColor: '#1a1a1a',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'Inter'
      },
      children: [
        // Avatar
        avatarDataUri
          ? {
              type: 'img',
              props: {
                src: avatarDataUri,
                width: 120,
                height: 120,
                style: {
                  borderRadius: '60px',
                  objectFit: 'cover'
                }
              }
            }
          : {
              type: 'div',
              props: {
                style: {
                  width: 120,
                  height: 120,
                  borderRadius: '60px',
                  background: 'linear-gradient(135deg, #c8ff00, #a0cc00)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 48,
                  fontWeight: 700,
                  color: '#000000'
                },
                children: displayName.charAt(0).toUpperCase()
              }
            },
        // Display name
        {
          type: 'div',
          props: {
            style: {
              fontSize: 48,
              fontWeight: 700,
              color: '#ffffff',
              marginTop: '24px'
            },
            children: displayName
          }
        },
        // Username
        {
          type: 'div',
          props: {
            style: {
              fontSize: 28,
              color: '#888888',
              marginTop: '8px'
            },
            children: `@${username}`
          }
        },
        // Logo bottom-right
        {
          type: 'img',
          props: {
            src: logo,
            width: 140,
            height: 35,
            style: {
              position: 'absolute',
              bottom: '40px',
              right: '48px'
            }
          }
        }
      ]
    }
  }
}

export async function renderOgPng(layout: unknown): Promise<Uint8Array> {
  const fonts = await loadFonts()
  const svg = await satori(layout, {
    width: WIDTH,
    height: HEIGHT,
    fonts
  })
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: WIDTH }
  })
  return resvg.render().asPng()
}

export { workflowLayout, creatorLayout, fetchImageAsDataUri }

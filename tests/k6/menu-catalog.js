import http from 'k6/http'
import { check, sleep } from 'k6'
import { Counter } from 'k6/metrics'

const baseUrl = (__ENV.BASE_URL || 'http://127.0.0.1:3001').replace(/\/$/, '')
const vus = Number(__ENV.VUS || 10)
const duration = __ENV.DURATION || '20s'
const rampUp = __ENV.RAMP_UP || '10s'
const rampDown = __ENV.RAMP_DOWN || '5s'
const thinkTimeSeconds = Number(__ENV.THINK_TIME_SECONDS || 1)
const menuCatalogErrors = new Counter('menu_catalog_errors')

export const options = {
  scenarios: {
    menu_catalog: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: rampUp, target: vus },
        { duration, target: vus },
        { duration: rampDown, target: 0 },
      ],
      gracefulRampDown: '5s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<500'],
  },
}

export default function () {
  const response = http.get(`${baseUrl}/menu-items`, {
    tags: { feature: 'menu-catalog' },
    timeout: '10s',
  })

  if (response.status !== 200) {
    menuCatalogErrors.add(1, { status: String(response.status || 'network') })
  }

  check(response, {
    'menu catalog returns HTTP 200': (res) => res.status === 200,
    'menu catalog returns JSON': (res) => res.headers['Content-Type']?.includes('application/json') === true,
  })

  if (thinkTimeSeconds > 0) sleep(thinkTimeSeconds)
}

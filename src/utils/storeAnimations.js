import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(useGSAP, ScrollTrigger)

export const motionAllowed = '(prefers-reduced-motion: no-preference)'

export { gsap, ScrollTrigger, useGSAP }

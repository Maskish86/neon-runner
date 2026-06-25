import * as THREE from 'three'
import { INVINCIBLE_DURATION } from './constants.js'

export function boxesOverlap(a, b) {
  return (
    a.min.x < b.max.x && a.max.x > b.min.x &&
    a.min.y < b.max.y && a.max.y > b.min.y &&
    a.min.z < b.max.z && a.max.z > b.min.z
  )
}

export function checkCollisions(playerApi, obstacleApi, collectibleApi, gameState) {
  if (gameState.player.invincibleTimer > 0) return { hitObstacle: false, hitCollectible: null }

  const playerBox = playerApi.getAABB()
  let hitObstacle = false
  let hitCollectible = null

  // Obstacle collision — skip during HOVER power-up (player above ground obstacles)
  const hovering = gameState.powerUp?.type === 'HOVER'
  obstacleApi.getActive().forEach(obs => {
    if (hitObstacle) return
    if (hovering && obs.type !== 'LASER_GATE') return  // hover skips ground obstacles
    // Z window: only check obstacles near the player
    if (obs.mesh.position.z < -2 || obs.mesh.position.z > 3) return
    const obsBox = obs.getAABB()
    if (boxesOverlap(playerBox, obsBox)) hitObstacle = true
  })

  // Collectible collision
  collectibleApi.getActive().forEach(col => {
    if (hitCollectible) return
    if (col.mesh.position.z < -2 || col.mesh.position.z > 3) return
    const colBox = col.getAABB()
    if (boxesOverlap(playerBox, colBox)) hitCollectible = col
  })

  return { hitObstacle, hitCollectible }
}

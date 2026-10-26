describe('TraiNext authentication', () => {
  it('shows the sign-in screen', () => {
    cy.visit('/')
    cy.contains('TraiNext')
    cy.contains('Geofenced OJT attendance, safety and accomplishment tracking')
    cy.contains('Sign in')
  })
})

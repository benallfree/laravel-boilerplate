import React, { Component } from 'react'
import { BrowserRouter, Route } from 'react-router-dom'
import _ from 'lodash'
import { Message, Container } from 'semantic-ui-react'
import { subscribe } from 'react-contextual'
import { TopNav, ComponentBase, RouteRenderer, NavWatcher } from './Core'

@subscribe('ioc')
class Root extends ComponentBase {
  loadState() {
    const {
      ioc: { setUser },
    } = this.props
    return {
      user: this.api.getCurrentUser().then(user => {
        setUser(user)
      }),
    }
  }

  renderLoaded() {
    const {
      ioc: { routes, message },
    } = this.props
    return (
      <BrowserRouter>
        <React.Fragment>
          <Route
            path="*"
            render={props => <TopNav routes={routes} {...props} />}
          />
          <Route path="*" component={NavWatcher} />
          <Container fluid>
            {message && <Message info>{message}</Message>}
            {_.map(routes, (r, idx) => (
              <Route
                exact
                key={`${idx}`}
                path={r.path}
                component={r.component}
              />
            ))}
          </Container>
        </React.Fragment>
      </BrowserRouter>
    )
  }
}

export { Root }

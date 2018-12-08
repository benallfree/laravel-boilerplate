import React, { Component } from 'react'
import _ from 'lodash'
import { Table, Button, Message, Header, Icon, Label } from 'semantic-ui-react'
import changeCase, { paramCase } from 'change-case'
import { subscribe } from 'react-contextual'
import { ComponentBase } from '../ComponentBase'
import * as Fields from './Fields'

function createMask(s) {
  const arr = _.map(s, c => {
    if (c.match(/\d/) !== null) {
      return /\d/
    }
    return c
  })
  return arr
}

@subscribe('ioc')
class Form extends ComponentBase {
  loadState() {
    const input = {}
    const { context } = this.props
    let allValid = true
    const validState = {}
    this.fields = this.buildFields()
    _.each(this.fields, fieldInfo => {
      const { name, defaultValue, validate, format, options } = fieldInfo
      let v = defaultValue({ context, fieldInfo, options })
      const isValid = validate({ context, fieldInfo, value: v }) === true
      allValid = allValid && isValid
      if (isValid) {
        v = format({ context, fieldInfo, value: v })
      }
      validState[name] = true
      input[name] = v === null ? '' : v
    })
    return {
      input,
      helpState: {},
      allValid,
      validState,
      changedSinceLastBlur: true,
      fieldErrors: {},
    }
  }

  buildFields() {
    const defaults = {
      required: false,
      type: () => 'Text',
      placeholder: ({ fieldInfo }) => changeCase.title(fieldInfo.name),
      label: ({ fieldInfo }) => changeCase.title(fieldInfo.name),
      options: () => [],
      content: ({ fieldInfo }) => (
        <div>{changeCase.title(fieldInfo)} content</div>
      ),
      displayIf: () => true,
      defaultValue: ({ fieldInfo }) => null,
      inputLabel: () => '',
      help: () => null,
      validate: () => true,
      mask: () => false,
      unmask: ({ value }) => value,
      inputFormat: ({ value }) => value,
      format: ({ value }) => value,
      input: ({ value }) => value,
      calculate: () => {},
      icon: () => false,
      params: () => {
        return {}
      },
    }

    function createHandler({ handlerName, fieldHandler, defaultHandler }) {
      function create() {
        let val = fieldHandler
        if (val === undefined) val = defaultHandler
        if (typeof val === 'function') return val
        switch (handlerName) {
          case 'mask':
            if (typeof val === 'string') {
              val = createMask(val)
              return () => val
            }
            break
          case 'unmask':
            if (val instanceof RegExp) {
              return ({ value }) => value.replace(val, '')
            }
            break
          case 'validate':
            if (val instanceof RegExp) {
              return ({ value }) => (value ? value.match(val) !== null : true)
            }
            break
          default:
            break
        }
        return () => val
      }

      const handler = create()
      switch (handlerName) {
        case 'validate':
          return args => {
            const { fieldInfo, value } = args
            const { required } = fieldInfo
            const isRequired = required(args)
            const isEmpty =
              value === undefined ||
              value === null ||
              (typeof value === 'string' && value.trim().length === 0)
            if (isRequired && isEmpty) {
              return `Required`
            }
            return handler(args)
          }
        case 'defaultValue':
          return args => {
            const { fieldInfo } = args
            const { format, defaultValue } = fieldInfo
            let value = handler(args)
            const isEmpty =
              value === undefined ||
              value === null ||
              (typeof value === 'string' && value.trim().length === 0)
            if (!isEmpty) {
              value = format({ ...args, value })
            }
            return value
          }
        default:
      }
      return handler
    }

    const { fields } = this.props
    const ret = {}
    _.each(fields, (f, fieldName) => {
      ret[fieldName] = { name: fieldName }
      _.each(defaults, (v, k) => {
        ret[fieldName][k] = createHandler({
          handlerName: k,
          fieldHandler: f[k],
          defaultHandler: v,
        })
      })
    })

    return ret
  }

  componentDidMount() {
    super.componentDidMount()
    setImmediate(() => this.notifyValidState())
  }

  notifyValidState() {
    const { allValid, input, changedSinceLastBlur } = this.state
    const { onValid, onInvalid, context } = this.props
    if (!changedSinceLastBlur) return
    this.setState({ changedSinceLastBlur: false })
    if (allValid) {
      onValid(input, context)
    } else {
      onInvalid(input, context)
    }
  }

  createHandleChangeAndBlur = (args, valueField = 'value') =>
    this.createHandleChange(args, valueField, newValue =>
      this.handleBlur({ ...args, value: newValue }),
    )

  createHandleChange = (args, valueField = 'value', cb = newValue => {}) => (
    e,
    d,
  ) => {
    const { input } = this.state
    const { fieldInfo } = args
    const { name, unmask, calculate } = fieldInfo
    const { value: maskedValue, ...rest } = args
    const value = unmask({ ...rest, value: d[valueField] })
    input[fieldInfo.name] = value
    calculate({ ...args, form: input, value })
    this.setState({ input, changedSinceLastBlur: true }, () =>
      this.setState({ allValid: this.calcAllValid() }, () => cb(value)),
    )
    this.props.onChange(fieldInfo.name, value, input)
  }

  calcAllValid() {
    return _.reduce(
      this.fields,
      (res, f, name) => {
        const { input } = this.state
        const { context } = this.props
        const { validate } = f
        const args = { form: input, context, fieldInfo: f, value: input[name] }
        const validResult = validate(args)
        const isValid = validResult === true
        return res && isValid
      },
      true,
    )
  }

  handleBlur = args => {
    const { value } = args
    if (value.length === 0) return
    this.validate(args, () => {
      const { input } = this.state
      const { fieldInfo } = args
      const { format } = fieldInfo
      input[fieldInfo.name] = format({ ...args, value: input[fieldInfo.name] })
      this.setState({ input }, () => this.notifyValidState())
    })
  }

  validate = (args, cb = null) => {
    const { validState, fieldErrors } = this.state
    const { fieldInfo } = args
    const { name, validate } = fieldInfo
    const validResult = validate(args)
    validState[name] = validResult === true
    fieldErrors[name] = validResult
    const allValid = this.calcAllValid()
    this.setState({ allValid, validState, fieldErrors }, cb)
    return validState[name]
  }

  hasFieldError = args => {
    const { validState } = this.state
    const { fieldInfo } = args
    const { name } = fieldInfo

    return validState[name] === false
  }

  fieldErrorMessage = fieldName => {
    const { fieldErrors } = this.state
    return fieldErrors[fieldName]
  }

  validateAll = () => {
    return _.reduce(
      this.fields,
      (res, f, name) => {
        const { input } = this.state
        const { context } = this.props
        const args = { form: input, context, fieldInfo: f, value: input[name] }
        const isValid = this.validate(args)
        return res && isValid
      },
      true,
    )
  }

  handleSave = () => {
    if (!this.calcAllValid()) return

    const { input } = this.state
    const { onSubmit } = this.props
    this.setState({
      save: onSubmit(input)
        .then(() => {
          const fieldErrors = {}
          const validState = {}
          this.setState({ fieldErrors, validState })
        })
        .catch(e => {
          if (!(e.response && e.response.messages)) throw e
          const fieldErrors = {}
          const validState = {}
          _.each(_.pick(e.response.messages, _.keys(this.fields)), (m, k) => {
            fieldErrors[k] = m
            validState[k] = false
          })
          fieldErrors['*'] = e.response.messages['*']
          this.setState({ fieldErrors, validState })
          throw e
        }),
    })
  }

  handleHelp = name => {
    const { helpState } = this.state
    helpState[name] = !(helpState[name] || false)
    this.setState({ helpState })
  }

  handleCancel = () => {
    const { onCancel } = this.props
    if (!onCancel) return
    onCancel()
  }

  saveButtons() {
    const { allValid } = this.state
    const save = this.asyncState('save')
    const {
      onCancel,
      saveButtonText,
      saveButtonIcon,
      cancelButtonText,
    } = this.props
    return (
      <React.Fragment>
        {onCancel && (
          <Button negative onClick={this.handleCancel}>
            <Icon name="close" />
            {cancelButtonText}
          </Button>
        )}
        <Button
          loading={save.isLoading}
          disabled={!allValid || save.isLoading}
          primary
          onClick={this.handleSave}
        >
          {saveButtonIcon && <Icon name={saveButtonIcon} />}
          {saveButtonText}
        </Button>
      </React.Fragment>
    )
  }

  renderSectionRow(fieldInfo, control, args) {
    const { inputsOnly } = this.props
    if (inputsOnly) {
      return (
        <React.Fragment>
          <div style={{ marginTop: 20 }}>{control}</div>
        </React.Fragment>
      )
    }
    return (
      <Table.Row>
        <Table.Cell style={{ backgroundColor: 'initial' }} colSpan={2}>
          <div style={{ marginTop: 20 }}>{control}</div>
        </Table.Cell>
      </Table.Row>
    )
  }

  renderDefaultRow(fieldInfo, control, args) {
    const { helpState } = this.state
    const { inputsOnly } = this.props
    const { name, label, help } = fieldInfo
    return (
      <React.Fragment>
        {inputsOnly && (
          <React.Fragment>
            {control}
            {this.hasFieldError(args) && (
              <div style={{ color: 'red' }}>{this.fieldErrorMessage(name)}</div>
            )}
          </React.Fragment>
        )}
        {!inputsOnly && (
          <Table.Row>
            <Table.Cell collapsing style={{ verticalAlign: 'top' }}>
              {label(args)}{' '}
              {help(args) && (
                <Icon
                  circular
                  link
                  size="mini"
                  name="help"
                  inverted={helpState[name] || false}
                  style={{ position: 'relative', top: -3 }}
                  onClick={() => this.handleHelp(name)}
                />
              )}
            </Table.Cell>
            <Table.Cell>
              {control}
              {helpState[name] && <Label pointing>{help(args)}</Label>}
              {this.hasFieldError(args) && (
                <div style={{ color: 'red' }}>
                  {this.fieldErrorMessage(name)}
                </div>
              )}
            </Table.Cell>
          </Table.Row>
        )}
      </React.Fragment>
    )
  }

  buildFormRows() {
    const { input } = this.state
    const { context } = this.props

    return _.map(this.fields, (f, name) => {
      const { type, displayIf } = f
      let control = null
      const args = { form: input, context, fieldInfo: f, value: input[name] }
      const props = {
        ...args,
        error: this.hasFieldError(args),
        onBlur: () => this.handleBlur(args),
      }
      if (!displayIf(args)) return null
      const resolvedType = type(args)
      switch (resolvedType) {
        case 'Text':
          control = Fields.Text({
            ...props,
            onChange: event =>
              this.createHandleChange(args)(event, {
                value: event.target.value,
              }),
          })
          break
        case 'Dropdown':
          control = Fields.Dropdown({
            ...props,
            onChange: this.createHandleChangeAndBlur(args),
          })
          break
        case 'Checklist':
          control = React.createElement(Fields.Checklist, {
            ...props,
            onChange: this.createHandleChangeAndBlur(args),
          })
          break
        case 'Toggle':
          control = Fields.Toggle({
            ...props,
            onChange: this.createHandleChangeAndBlur(args, 'checked'),
          })
          break
        case 'Section':
          control = Fields.Section(props)
          break
        case 'Div':
          control = Fields.Div(props)
          break
        default:
          control = <div>Type {type(args)} invalid</div>
          break
      }
      switch (resolvedType) {
        case 'Section':
          return this.renderSectionRow(f, control, args)
        default:
          return this.renderDefaultRow(f, control, args)
      }
    })
  }

  renderLoaded() {
    const save = this.asyncState('save')
    const { inputsOnly, submittedMessage, submittingMessage } = this.props

    const saveButtons = this.saveButtons()

    const rows = this.buildFormRows()

    return (
      <React.Fragment>
        {save.isLoaded && <Message success>{submittedMessage}</Message>}
        {save.isLoading && <Message>{submittingMessage}</Message>}
        {save.error && (
          <Message error>
            {this.fieldErrorMessage('*') ||
              'Please correct the errors below and try again.'}
          </Message>
        )}
        {inputsOnly && (
          <React.Fragment>
            {_.map(rows, (r, idx) => (
              <div key={idx} style={{ marginBottom: 5 }}>
                {r}
              </div>
            ))}
            {saveButtons}
          </React.Fragment>
        )}
        {!inputsOnly && (
          <Table definition>
            <Table.Body>
              {rows}
              <Table.Row>
                <Table.Cell />
                <Table.Cell style={{ textAlign: 'right' }}>
                  {saveButtons}
                </Table.Cell>
              </Table.Row>
            </Table.Body>
          </Table>
        )}
      </React.Fragment>
    )
  }
}

Form.defaultProps = {
  onChange: () => {},
  onSubmit: () => {},
  onCancel: null,
  onValid: () => {},
  onInvalid: () => {},
  saveButtonText: 'Save',
  saveButtonIcon: null,
  cancelButtonText: 'Cancel',
  inputsOnly: false,
  submittingMessage: 'Saving...',
  submittedMessage: 'Saved.',
}

export { Form }

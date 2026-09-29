import { Component } from 'react';

export default class SceneErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('Fitting stage failed to render:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="mirror-frame mirror-frame--error">
          <p>3D-модель сейчас недоступна. Выбор размера и покупка работают без неё.</p>
          <button className="btn btn--ghost" type="button" onClick={() => this.setState({ error: null })}>
            Повторить загрузку
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

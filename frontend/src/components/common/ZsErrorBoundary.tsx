import React from 'react';

/**
 * 全局渲染错误边界（round-10）：任何工具视图内的渲染期异常（如 reducer 阶段
 * TypeError）都会把整棵 React 树卸掉 = 白屏卡死。此边界把故障圈定在当前视图，
 * 显示可读错误与「回到首页」出口，App 壳/导航保持可用。
 */
interface Props {
  children: React.ReactNode;
  resetKey?: string; // 变化时自动清除错误状态（切工具恢复）
}

interface State {
  error: Error | null;
}

export class ZsErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidUpdate(prevProps: Props) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-3 p-8 text-center">
          <div className="max-w-md w-full bg-white rounded-2xl border-[3px] border-mem-ink shadow-memphis-lg p-6">
            <h2 className="text-lg font-black text-mem-ink mb-2">页面出错了</h2>
            <p className="text-sm text-mem-ink/70 mb-3 break-all">
              {this.state.error.message || String(this.state.error)}
            </p>
            <button
              className="memphis-btn-primary w-full py-2.5 text-sm"
              onClick={() => this.setState({ error: null })}
            >
              重试当前页面
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

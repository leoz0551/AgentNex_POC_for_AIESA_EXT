import traceback
import textwrap
import json
import logging
from inspect import cleandoc

from agno.tools import tool
from agno.run import RunContext
from data_cache import get_session_dfs
import pandas as pd

logger = logging.getLogger(__name__)

@tool
def execute_pandas_analysis(run_context: RunContext, python_code: str) -> str:
    """
    执行 Pandas 数据分析并返回结果的沙箱环境。
    
    >>> 核心机制:
    该沙箱会自动注入你在当前会话通过 fetch_xxx 技能获取的所有 DataFrame 句柄。
    如果之前调了 fetch_users_by_org，那么环境中会有 'df_users' 变量。
    如果之前调了 fetch_query_by_user_and_time，那么会有 'df_queries'。
    你可以使用 pd.merge(df1, df2, on='...') 进行关联分析。
    
    >>> 任务目标:
    按照计算逻辑处理数据后，必须将结果（Dict 或 Echarts 配置）赋给局部变量 `result`。
    如果是图表，格式必须为: result = {"type": "echarts", "config": { ... }}
    
    可用导入:
    - pandas as pd
    - json
    
    Args:
        python_code: 纯 Python 代码字符串。
    """
    session_id = run_context.session_id or "default_session"
    logger.info(f"[SANDBOX] Starting analysis for session: {session_id}")
    
    # 1. 获取当前会话下所有的 DF 句柄
    cached_dfs = get_session_dfs(session_id)
    if not cached_dfs:
        logger.warning(f"[SANDBOX] No cached DataFrames found for session {session_id}")
        return "【沙箱执行失败】当前环境中没有任何已加载的数据。请先调用 fetch_xxx 类技能获取数据句柄（如 df_users）。"
    
    logger.info(f"[SANDBOX] Injecting following handles: {list(cached_dfs.keys())}")
    
    # 2. 准备执行环境
    code = cleandoc(python_code)
    safe_builtins = __builtins__.copy() if isinstance(__builtins__, dict) else __builtins__.__dict__.copy()
    for dangerous in ['eval', 'exec', 'open', 'quit', 'exit', 'importlib', 'reload']:
        safe_builtins.pop(dangerous, None)
        
    restricted_globals = {
        "__builtins__": safe_builtins,
        "pd": pd,
        "json": json,
    }
    # 注入用户之前获取的 DataFrames
    restricted_globals.update(cached_dfs)
    
    # 增加别名，防止大模型幻觉使用了 df_details 代替 df_query_details
    if "df_query_details" in cached_dfs and "df_details" not in cached_dfs:
        restricted_globals["df_details"] = cached_dfs["df_query_details"]
    
    local_vars = {}
    import io
    import sys
    
    # 捕获 stdout 以防止 print() 污染主进程日志，并能将输出返回给 Agent
    f = io.StringIO()
    
    try:
        # 3. 封装并执行
        exec_code = f"def run_analysis():\n" + textwrap.indent(code, '    ') + "\n    return locals().get('result', None)"
        
        logger.info(f"[SANDBOX] Executing Python code snippet (len: {len(code)})")
        
        # 重定向 stdout
        old_stdout = sys.stdout
        sys.stdout = f
        
        try:
            exec(exec_code, restricted_globals, local_vars)
            func = local_vars['run_analysis']
            exec_result = func()
        finally:
            sys.stdout = old_stdout
            
        captured_output = f.getvalue()
        
        if captured_output:
            # 简化日志显示：仅在控制台显示前 500 个字符，防止日志爆炸
            log_output = (captured_output[:500] + "..[TRUNCATED]..") if len(captured_output) > 500 else captured_output
            logger.info(f"[SANDBOX] Captured Output:\n{log_output}")
            
        if exec_result is None:
            # 如果 result 为空但有 stdout，尝试把 stdout 作为结果的一部分（兼容习惯）
            if captured_output:
                logger.info("[SANDBOX] Execution successful (via stdout).")
                return f"【沙箱执行结果(Output)】:\n{captured_output}"
            
            logger.warning("[SANDBOX] Execution completed but 'result' variable is None")
            return "【沙箱执行结果】执行结束，但是未设置 `result` 变量。请确保你的代码最后一行包含类似 `result = ...` 的赋值。"
            
        logger.info("[SANDBOX] Execution successful.")
        
        # 最终返回给 Agent 的内容可以包含 stdout 和 result
        final_response = ""
        if captured_output:
            final_response += f"--- 控制台输出 ---\n{captured_output}\n"
        
        if isinstance(exec_result, dict):
            final_response += f"【结果数据(JSON)】: {json.dumps(exec_result, ensure_ascii=False)}"
        else:
            final_response += f"【结果数据】: {str(exec_result)}"
            
        return final_response
            
    except Exception as e:
        error_msg = traceback.format_exc()
        logger.error(f"[SANDBOX] Execution error: {e}\n{error_msg}")
        return f"【沙箱执行报错】:\n{str(e)}\n\n请根据逻辑修复代码。"

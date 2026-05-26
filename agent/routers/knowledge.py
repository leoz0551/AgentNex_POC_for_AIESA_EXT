"""
知识库管理路由
"""

import uuid
import shutil
import logging
import re
import requests
from pathlib import Path
from typing import List, Optional
from urllib.parse import urlparse
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from bs4 import BeautifulSoup
from readability.readability import Document

from config import KNOWLEDGE_DIR
from database import knowledge, chroma_db
from services.document_service import document_service
from agno.knowledge.reader.website_reader import WebsiteReader

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/knowledge", tags=["knowledge"])


def fetch_webpage_content(url: str) -> tuple:
    """
    使用 requests + readability 提取网页核心内容
    返回: (内容, 摘要, 标题)
    """
    clean_content = ""
    title = ""
    html_text = ""
    
    # 多个 User-Agent 轮换，增加成功率
    user_agents = [
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Mobile/15E148 Safari/604.1',
    ]
    
    parsed_url = urlparse(url)
    
    for i, ua in enumerate(user_agents):
        try:
            headers = {
                'User-Agent': ua,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7',
            }
            
            if parsed_url.netloc:
                headers['Referer'] = f"{parsed_url.scheme}://{parsed_url.netloc}/"
            
            logger.info(f"[Fetch] Attempt {i+1}: {url}")
            response = requests.get(url, headers=headers, timeout=30, allow_redirects=True)
            response.raise_for_status()
            
            # 检查内容类型
            content_type = response.headers.get('Content-Type', '').lower()
            logger.info(f"[Fetch] Content-Type: {content_type}, encoding: {response.encoding}, size: {len(response.content)} bytes")
            
            # 如果是 PDF，提示使用文档上传
            if 'pdf' in content_type or url.lower().endswith('.pdf'):
                logger.warning(f"[Fetch] PDF detected")
                return "", "", "PDF 文件 - 请使用文档上传功能"
            
            # 正确处理编码 - 使用 response.content 手动解码
            # 先尝试从 Content-Type 获取编码
            encoding = None
            if 'charset=' in content_type:
                match = re.search(r'charset=([^\s;]+)', content_type)
                if match:
                    encoding = match.group(1).strip('"\'')
            
            # 如果没有找到编码，使用 apparent_encoding 或默认 utf-8
            if not encoding:
                encoding = response.apparent_encoding or 'utf-8'
            
            # 解码内容
            try:
                html_text = response.content.decode(encoding)
            except (UnicodeDecodeError, LookupError):
                # 如果指定编码失败，尝试常见编码
                for enc in ['utf-8', 'gbk', 'gb2312', 'latin-1']:
                    try:
                        html_text = response.content.decode(enc)
                        logger.info(f"[Fetch] Successfully decoded with {enc}")
                        break
                    except (UnicodeDecodeError, LookupError):
                        continue
                else:
                    html_text = response.content.decode('utf-8', errors='replace')
            
            logger.info(f"[Fetch] Decoded HTML length: {len(html_text)} chars")
            
            # 针对不同网站类型采用不同的提取策略
            contents = []
            
            # 方法1: readability 提取（适合文章类页面，如CGTN新闻）
            try:
                doc = Document(html_text)
                content = doc.summary()
                readability_title = doc.title() or ""
                
                soup = BeautifulSoup(content, 'html.parser')
                readability_content = soup.get_text(separator='\n\n', strip=True)
                
                logger.info(f"[Fetch] Readability: title='{readability_title[:50]}...', content={len(readability_content)} chars")
                contents.append(('readability', readability_content, readability_title))
            except Exception as e:
                logger.warning(f"[Fetch] Readability failed: {e}")
            
            # 方法2: 直接提取（适合列表页、产品页等，如Lenovo产品页面）
            try:
                soup = BeautifulSoup(html_text, 'html.parser')
                
                # 移除无关标签
                for tag in soup(['script', 'style', 'nav', 'footer', 'header', 'aside', 'iframe', 'noscript', 'form', 'button', 'input', 'select', 'textarea', 'svg']):
                    tag.decompose()
                
                # 尝试提取 article/main 标签（新闻页面优先）
                article = soup.find('article') or soup.find('main') or soup.find(class_='content') or soup.find(class_='article') or soup.find('div', class_='news-content')
                if article:
                    article_content = article.get_text(separator='\n', strip=True)
                    logger.info(f"[Fetch] Article tag: {len(article_content)} chars")
                    contents.append(('article', article_content, ''))
                
                # 针对CGTN新闻网站的特殊处理
                if 'cgtn.com' in parsed_url.netloc:
                    cgtn_content = ""
                    # CGTN通常有特定的class结构
                    news_body = soup.find('div', class_='news-body') or soup.find('div', class_='content') or soup.find('div', id='content')
                    if news_body:
                        cgtn_content = news_body.get_text(separator='\n\n', strip=True)
                        contents.append(('cgtn-specific', cgtn_content, ''))
                
                # 针对Lenovo产品页面的特殊处理
                if 'lenovo.com' in parsed_url.netloc:
                    lenovo_content = ""
                    # Lenovo产品页面通常包含产品规格、特性等信息
                    product_sections = soup.find_all(['section', 'div'], class_=lambda x: x and ('product' in x.lower() or 'spec' in x.lower() or 'feature' in x.lower()))
                    if product_sections:
                        lenovo_content = '\n\n'.join([sec.get_text(separator='\n', strip=True) for sec in product_sections])
                        contents.append(('lenovo-specific', lenovo_content, ''))
                    
                    # 专门针对PSREF网站的处理 (psref.lenovo.com)
                    if 'psref.lenovo.com' in parsed_url.netloc:
                        psref_content = ""
                        # PSREF网站通常有产品列表、规格表等
                        psref_sections = soup.find_all(['div', 'section'], class_=lambda x: x and ('product' in x.lower() or 'spec' in x.lower() or 'model' in x.lower() or 'configuration' in x.lower() or 'tech-spec' in x.lower()))
                        if psref_sections:
                            psref_content = '\n\n'.join([sec.get_text(separator='\n', strip=True) for sec in psref_sections])
                        
                        # 如果没找到特定区域，尝试查找包含产品信息的表格或列表
                        if not psref_content:
                            # 查找可能包含产品规格的表格
                            tables = soup.find_all('table')
                            if tables:
                                psref_content = '\n\n'.join([table.get_text(separator='\n', strip=True) for table in tables[:3]])  # 只取前3个表格避免内容过多
                        
                        # 如果还是没有，尝试提取主要内容
                        if not psref_content:
                            main_content = soup.find('main') or soup.find('div', class_='main-content') or soup.find('div', id='main') or soup.find('div', class_='content')
                            if main_content:
                                psref_content = main_content.get_text(separator='\n\n', strip=True)
                        
                        if psref_content:
                            contents.append(('psref-specific', psref_content, ''))
                    
                    # 如果没有找到特定区域，尝试提取主要内容区域
                    if not lenovo_content and 'psref.lenovo.com' not in parsed_url.netloc:
                        main_content = soup.find('main') or soup.find('div', class_='main-content') or soup.find('div', id='main')
                        if main_content:
                            lenovo_content = main_content.get_text(separator='\n\n', strip=True)
                            contents.append(('lenovo-main', lenovo_content, ''))
                
                # 直接提取全部文本作为备选
                direct_content = soup.get_text(separator='\n', strip=True)
                direct_content = '\n'.join(line.strip() for line in direct_content.split('\n') if line.strip())
                contents.append(('direct', direct_content, ''))
                
                logger.info(f"[Fetch] Direct extraction: {len(direct_content)} chars")
            except Exception as e:
                logger.warning(f"[Fetch] Direct extraction failed: {e}")
            
            # 如果还没有内容，至少提取标题和meta描述
            if not contents or all(len(c[1]) == 0 for c in contents):
                try:
                    soup = BeautifulSoup(html_text, 'html.parser')
                    meta_title = ""
                    meta_description = ""
                    
                    # 提取标题
                    title_tag = soup.find('title')
                    if title_tag:
                        meta_title = title_tag.get_text(strip=True)
                    
                    # 提取meta description
                    meta_desc = soup.find('meta', attrs={'name': 'description'})
                    if meta_desc and meta_desc.get('content'):
                        meta_description = meta_desc.get('content')
                    
                    if meta_title or meta_description:
                        fallback_content = ""
                        if meta_description:
                            fallback_content = meta_description
                        elif meta_title:
                            fallback_content = f"页面标题: {meta_title}"
                        
                        contents.append(('fallback-meta', fallback_content, meta_title))
                except Exception as e:
                    logger.warning(f"[Fetch] Fallback meta extraction failed: {e}")
            
            # 选择最好的内容（按长度排序，但也要考虑质量）
            if contents:
                # 优先选择有实际内容的方法
                valid_contents = [(method, content, t) for method, content, t in contents if len(content) > 10]
                if valid_contents:
                    best = max(valid_contents, key=lambda x: len(x[1]))
                    clean_content = best[1]
                    title = best[2]
                else:
                    # 如果都没有足够内容，选择第一个
                    best = contents[0]
                    clean_content = best[1]
                    title = best[2]
            else:
                clean_content = ""
                title = ""
            
            # 如果还是没有标题，从 HTML 提取
            if not title:
                try:
                    soup = BeautifulSoup(html_text, 'html.parser')
                    title_tag = soup.find('title')
                    title = title_tag.get_text(strip=True) if title_tag else ""
                except:
                    pass
            
            logger.info(f"[Fetch] Best method: {best[0] if contents else 'none'}, content: {len(clean_content)} chars, title: {title[:50] if title else 'N/A'}...")
            
            # 如果提取到足够内容，直接返回
            if len(clean_content) >= 50:
                summary = clean_content[:200] + "..." if len(clean_content) > 200 else clean_content
                logger.info(f"[Fetch] Success with User-Agent {i+1}")
                return clean_content, summary, title
            
            # 内容不足，尝试下一个 User-Agent
            logger.warning(f"[Fetch] Content too short ({len(clean_content)} chars), trying next User-Agent")
            
        except Exception as e:
            logger.error(f"[Fetch] Attempt {i+1} failed: {e}")
            continue
    
    # 所有尝试后返回结果
    summary = clean_content[:200] + "..." if len(clean_content) > 200 else clean_content
    logger.info(f"[Fetch] Final: {len(clean_content)} chars from {url}")
    return clean_content, summary, title


# ==================== 文档上传 ====================

@router.post("/upload")
async def upload_knowledge(
    file: UploadFile = File(...),
    user_id: str = Form(default="default")
):
    """
    上传文档到知识库

    支持:
    - PDF 文档 (.pdf)
    - 文本文件 (.txt)
    - Markdown 文件 (.md, .markdown)
    """
    try:
        doc_id = str(uuid.uuid4())
        filename = file.filename or "unknown"
        file_ext = Path(filename).suffix.lower()

        # 保存文件
        file_path = KNOWLEDGE_DIR / f"{doc_id}_{filename}"
        with open(file_path, "wb") as f:
            shutil.copyfileobj(file.file, f)

        logger.info(f"File saved to: {file_path}")
        logger.info(f"File size: {file_path.stat().st_size} bytes")

        # 添加到知识库
        try:
            knowledge.insert(path=str(file_path))
            logger.info(f"Successfully inserted {filename} into knowledge base")

            # 验证
            test_search = knowledge.search(query=filename[:20])
            logger.info(f"Verification search results count: {len(test_search) if test_search else 0}")

        except Exception as insert_error:
            logger.error(f"Failed to insert into knowledge base: {insert_error}")
            raise

        # 记录元数据
        document_service.add(
            doc_id=doc_id,
            filename=filename,
            file_path=str(file_path),
            doc_type=file_ext,
            user_id=user_id,
            chunk_count=0
        )

        return {
            "status": "ok",
            "message": f"文件 '{filename}' 已上传到知识库",
            "doc_id": doc_id,
            "file_path": str(file_path),
            "chunk_count": 0,
            "type": file_ext
        }
    except Exception as e:
        logger.error(f"Upload knowledge error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/url")
async def add_knowledge_url(request: dict):
    """添加 URL 内容到知识库"""
    try:
        url = request.get("url")
        user_id = request.get("user_id", "default")

        if not url:
            raise HTTPException(status_code=400, detail="URL is required")

        doc_id = str(uuid.uuid4())

        logger.info(f"[URL] Starting to parse: {url}")
        
        # 先获取向量库中的数量
        vector_count_before = 0
        try:
            vector_count_before = chroma_db.get_count() if hasattr(chroma_db, 'get_count') else 0
        except:
            pass
        logger.info(f"[URL] Vector count before: {vector_count_before}")

        # 用于存储网页元信息
        webpage_title = ""
        webpage_summary = ""

        # 优先使用 fetch_webpage_content
        content_fetched = False
        
        content, summary, title = fetch_webpage_content(url)
        
        # 降低阈值：只要有内容或标题+摘要就尝试插入
        has_content = content and len(content) > 50
        has_metadata = title and summary
        
        if has_content or has_metadata:
            webpage_title = title
            webpage_summary = summary
            # 如果没有正文内容，至少插入标题和摘要
            text_to_insert = content if has_content else f"标题: {title}\n\n摘要: {summary}"
            
            logger.info(f"[URL] Content preview: {text_to_insert[:100]!r}")
            logger.info(f"[URL] Content printable ratio: {sum(c.isprintable() or c.isspace() for c in text_to_insert) / len(text_to_insert):.2%}")
            
            # 直接插入文本内容
            knowledge.insert(
                text_content=text_to_insert,
                metadata={
                    "doc_id": doc_id,
                    "source": url,
                    "type": "url",
                    "user_id": user_id,
                    "title": title,
                    "summary": summary,
                }
            )
            content_fetched = True
            logger.info(f"[URL] Successfully fetched, {len(text_to_insert)} chars (content: {len(content)} chars)")

        # 备选 - WebsiteReader（如果 fetch_webpage_content 失败）
        if not content_fetched:
            try:
                website_reader = WebsiteReader(
                    max_depth=1,
                    max_links=0,
                    chunk=True,
                    chunk_size=3000,
                )
                documents = website_reader.read(url)
                if documents and len(documents) > 0:
                    total_chars = sum(len(doc.content) if hasattr(doc, 'content') else 0 for doc in documents)
                    logger.info(f"[URL] WebsiteReader returned {len(documents)} documents, {total_chars} chars total")
                    if total_chars > 100:
                        if hasattr(documents[0], 'content'):
                            first_content = documents[0].content
                            lines = first_content.split('\n')
                            for line in lines[:5]:
                                if line.strip().startswith('标题:') or line.strip().startswith('#'):
                                    webpage_title = line.replace('标题:', '').replace('#', '').strip()
                                    break
                            if not webpage_title:
                                webpage_title = url.split('/')[-1][:50] or "网页"
                            webpage_summary = first_content[:200] + "..." if len(first_content) > 200 else first_content
                        
                        knowledge.insert(url=url, reader=website_reader)
                        content_fetched = True
                        logger.info(f"[URL] Successfully used WebsiteReader")
            except Exception as e:
                logger.warning(f"[URL] WebsiteReader failed: {e}")
        
        if not content_fetched:
            raise HTTPException(
                status_code=400, 
                detail="无法从URL获取有效内容。可能原因：1) 页面需要登录；2) 动态加载页面(JS渲染)；3) 网络连接问题。请尝试其他URL或手动复制内容后使用'添加文本'功能。"
            )

        # 验证是否成功添加 - 改为更宽松的验证方式
        vector_count_after = 0
        try:
            vector_count_after = chroma_db.get_count() if hasattr(chroma_db, 'get_count') else 0
        except:
            pass
        logger.info(f"[URL] Vector count after: {vector_count_after}")
        vectors_added = vector_count_after - vector_count_before
        logger.info(f"[URL] Added {vectors_added} vectors")
        
        # 不再严格检查 vectors_added == 0，因为计数方法可能不准确
        # 改为检查内容是否合理且插入操作没有抛出异常
        if len(content) < 10 and not (title and summary):
            raise HTTPException(
                status_code=500, 
                detail="内容解析成功，但未能添加到向量库。请检查知识库服务是否正常运行。"
            )
        
        # 即使 vectors_added == 0，只要内容长度合理就认为成功
        # 因为向量计数方法可能有延迟或不准确
        
        # 立即测试搜索
        try:
            url_parts = [p for p in url.split('/') if p]
            test_query = url_parts[-1][:30] if url_parts else "test"
            if test_query:
                test_results = knowledge.search(query=test_query)
                logger.info(f"[URL] Test search for '{test_query}' returned {len(test_results) if test_results else 0} results")
                # 如果搜索测试失败，记录警告但不抛出错误
                if not test_results:
                    logger.warning(f"[URL] Test search returned no results, but content insertion may still be successful")
        except Exception as search_error:
            logger.error(f"[URL] Test search failed: {search_error}")

        logger.info(f"Successfully inserted URL: {url}")

        # 记录元数据（包含摘要和标题）
        document_service.add(
            doc_id=doc_id,
            filename=url,
            file_path=url,
            doc_type="url",
            user_id=user_id,
            chunk_count=vectors_added,
            title=webpage_title,
            summary=webpage_summary,
        )

        return {
            "status": "ok",
            "message": f"URL 已添加到知识库",
            "doc_id": doc_id,
            "url": url,
            "vectors_added": vectors_added,
            "title": webpage_title,
            "summary": webpage_summary,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Add knowledge URL error: {e}")
        import traceback
        traceback.print_exc()
        error_msg = str(e)
        if "ConnectionError" in error_msg or "timeout" in error_msg.lower():
            raise HTTPException(status_code=500, detail="网络连接失败，请检查URL是否正确或网络是否正常")
        elif "404" in error_msg or "Not Found" in error_msg:
            raise HTTPException(status_code=404, detail="页面不存在(404)，请检查URL地址是否正确")
        elif "403" in error_msg or "Forbidden" in error_msg:
            raise HTTPException(status_code=403, detail="访问被拒绝(403)，该页面可能需要登录或有访问限制")
        else:
            raise HTTPException(status_code=500, detail=f"URL解析失败: {error_msg}")


@router.post("/text")
async def add_knowledge_text(request: dict):
    """添加文本内容到知识库"""
    try:
        name = request.get("name", "unnamed")
        text = request.get("text")
        user_id = request.get("user_id", "default")
        
        if not text:
            raise HTTPException(status_code=400, detail="Text content is required")
        
        doc_id = str(uuid.uuid4())
        
        # 添加到知识库
        knowledge.insert(
            text_content=text,
            metadata={
                "doc_id": doc_id,
                "name": name,
                "user_id": user_id,
            }
        )
        
        # 记录元数据
        document_service.add(
            doc_id=doc_id,
            filename=name,
            file_path=f"text://{doc_id}",
            doc_type="text",
            user_id=user_id,
            chunk_count=len(text) // 1000 + 1,
        )
        
        return {
            "status": "ok",
            "message": f"文本 '{name}' 已添加到知识库",
            "doc_id": doc_id
        }
    except Exception as e:
        logger.error(f"Add knowledge text error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== 搜索 ====================

@router.get("/search")
async def search_knowledge(
    query: str,
    limit: int = 5,
    user_id: str = None,
    doc_id: str = None
):
    """搜索知识库"""
    try:
        logger.info(f"Searching knowledge base: query='{query}', limit={limit}")

        results = knowledge.search(query=query)
        logger.info(f"Raw search results count: {len(results) if results else 0}")

        # 格式化搜索结果，确保返回完整内容
        formatted_results = []
        for r in (results or []):
            formatted = {}
            
            # 提取内容
            if hasattr(r, 'content'):
                formatted['content'] = r.content
            elif hasattr(r, 'chunk'):
                formatted['content'] = r.chunk
            elif hasattr(r, 'text'):
                formatted['content'] = r.text
            elif isinstance(r, dict):
                formatted['content'] = r.get('content') or r.get('chunk') or r.get('text', '')
            else:
                formatted['content'] = str(r)
            
            # 提取元数据
            metadata = {}
            if hasattr(r, 'meta_data'):
                metadata = r.meta_data or {}
            elif hasattr(r, 'metadata'):
                metadata = r.metadata or {}
            elif isinstance(r, dict):
                metadata = r.get('metadata') or r.get('meta_data') or {}
            
            formatted['metadata'] = metadata
            
            # 提取分数
            if hasattr(r, 'distance'):
                formatted['score'] = 1 - r.distance if r.distance else 0
            elif hasattr(r, 'score'):
                formatted['score'] = r.score
            elif isinstance(r, dict):
                formatted['score'] = r.get('score') or r.get('relevance')
            
            formatted_results.append(formatted)
        
        # 过滤结果
        if user_id or doc_id:
            filtered = []
            for r in formatted_results:
                meta = r.get('metadata', {})
                if user_id and meta.get('user_id') != user_id:
                    continue
                if doc_id and meta.get('doc_id') != doc_id:
                    continue
                filtered.append(r)
            formatted_results = filtered
        
        logger.info(f"Formatted {len(formatted_results)} results")
        
        return {
            "query": query,
            "results": formatted_results,
            "count": len(formatted_results)
        }
    except Exception as e:
        logger.error(f"Search knowledge error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== 文档管理 ====================

@router.get("/documents")
async def list_knowledge_documents(user_id: str = None):
    """列出知识库文档"""
    try:
        documents = document_service.get(user_id=user_id)
        
        # 添加文件大小信息
        for doc in documents:
            document_service.enrich_with_file_info(doc)
        
        return {
            "documents": documents,
            "count": len(documents)
        }
    except Exception as e:
        logger.error(f"List knowledge documents error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/documents/{doc_id}")
async def get_knowledge_document(doc_id: str):
    """获取单个文档详情"""
    try:
        docs = document_service.get(doc_id=doc_id)
        if not docs:
            raise HTTPException(status_code=404, detail="Document not found")
        
        doc = docs[0]
        
        # 读取文件内容预览
        file_path = doc.get("file_path", "")
        preview = None
        if not file_path.startswith("text://") and not file_path.startswith("http"):
            p = Path(file_path)
            if p.exists() and p.suffix == ".txt":
                with open(p, "r", encoding="utf-8", errors="ignore") as f:
                    preview = f.read(2000)
        
        return {
            "document": doc,
            "preview": preview
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get document error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/documents/{doc_id}")
async def delete_knowledge_document(doc_id: str):
    """删除指定文档"""
    try:
        docs = document_service.get(doc_id=doc_id)
        if not docs:
            raise HTTPException(status_code=404, detail="Document not found")
        
        doc = docs[0]
        
        # 删除文件
        file_path = doc.get("file_path", "")
        if not file_path.startswith("text://") and not file_path.startswith("http"):
            p = Path(file_path)
            if p.exists():
                p.unlink()
        
        # 删除元数据
        document_service.remove(doc_id)
        
        return {
            "status": "ok",
            "message": f"文档已删除",
            "doc_id": doc_id
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Delete document error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("")
async def clear_knowledge():
    """清空知识库"""
    try:
        # 清空向量数据库
        try:
            collection = chroma_db.get_collection()
            if collection:
                all_items = collection.get()
                if all_items and all_items.get("ids"):
                    collection.delete(ids=all_items["ids"])
                    logger.info(f"Deleted {len(all_items['ids'])} vectors from ChromaDB")
        except Exception as e:
            logger.warning(f"Failed to clear ChromaDB: {e}")
        
        # 清空文件目录
        for file_path in KNOWLEDGE_DIR.glob("*"):
            if file_path.is_file():
                file_path.unlink()
        
        # 清空元数据
        document_service.clear()
        
        return {
            "status": "ok",
            "message": "知识库已清空"
        }
    except Exception as e:
        logger.error(f"Clear knowledge error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== 统计和调试 ====================

@router.get("/stats")
async def knowledge_stats():
    """获取知识库统计信息"""
    try:
        # 获取向量库统计
        vector_count = 0
        try:
            if hasattr(chroma_db, 'get_count'):
                vector_count = chroma_db.get_count()
            elif hasattr(chroma_db, 'count'):
                vector_count = chroma_db.count()
            logger.info(f"Vector count in ChromaDB: {vector_count}")
        except Exception as e:
            logger.error(f"Failed to get vector count: {e}")
            try:
                if hasattr(chroma_db, '_collection') and chroma_db._collection:
                    vector_count = chroma_db._collection.count()
            except Exception as e2:
                logger.error(f"Failed to get count from _collection: {e2}")

        # 获取文档统计
        stats = document_service.get_stats()
        stats["total_vectors"] = vector_count

        return stats
    except Exception as e:
        logger.error(f"Get knowledge stats error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/debug")
async def debug_knowledge(query: str = "pisa"):
    """调试端点：直接测试知识库搜索"""
    try:
        logger.info(f"[DEBUG] Direct knowledge search for: {query}")
        
        vector_count = 0
        all_vectors = []
        try:
            vector_count = chroma_db.get_count()
            if hasattr(chroma_db, '_collection') and chroma_db._collection:
                all_data = chroma_db._collection.get(limit=10)
                if all_data:
                    for i, doc_id in enumerate(all_data.get('ids', [])):
                        all_vectors.append({
                            'id': doc_id,
                            'document': all_data.get('documents', [])[i][:500] if all_data.get('documents') else None,
                            'metadata': all_data.get('metadatas', [])[i] if all_data.get('metadatas') else None,
                        })
        except Exception as e:
            logger.error(f"[DEBUG] Failed to get vectors: {e}")
        
        results = knowledge.search(query=query)
        
        formatted = []
        if results:
            for r in results:
                if hasattr(r, '__dict__'):
                    formatted.append({
                        "content": getattr(r, 'content', str(r)),
                        "name": getattr(r, 'name', None),
                        "metadata": getattr(r, 'meta_data', {}),
                    })
                elif isinstance(r, dict):
                    formatted.append({
                        "content": r.get("content", str(r)),
                        "metadata": r.get("metadata", {}),
                    })
                else:
                    formatted.append({"raw": str(r)})
        
        return {
            "query": query,
            "vector_count": vector_count,
            "results_count": len(results) if results else 0,
            "results": formatted,
            "sample_vectors": all_vectors,
        }
    except Exception as e:
        import traceback
        return {
            "error": str(e),
            "traceback": traceback.format_exc()
        }

import fitz  # PyMuPDF
import os

def extract_images_from_pdf(pdf_path, output_dir="imgs"):
    """
    从PDF文件中提取所有图片并保存到指定目录
    
    Args:
        pdf_path (str): PDF文件的路径
        output_dir (str): 图片保存的目录，默认是 extracted_images
    """
    # 创建输出目录（如果不存在）
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
    
    try:
        # 打开PDF文件
        doc = fitz.open(pdf_path)
        
        # 统计提取的图片总数
        image_count = 0
        
        # 遍历PDF的每一页
        for page_num in range(len(doc)):
            page = doc[page_num]
            # 获取当前页的所有图片
            image_list = page.get_images(full=True)
            
            # 如果当前页有图片
            if image_list:
                print(f"第 {page_num + 1} 页发现 {len(image_list)} 张图片")
                
                # 遍历当前页的每张图片
                for img_index, img in enumerate(image_list):
                    # img是一个元组，img[0]是图片的xref（引用编号）
                    xref = img[0]
                    # 获取图片的二进制数据
                    base_image = doc.extract_image(xref)
                    image_bytes = base_image["image"]
                    # 获取图片的扩展名（如png、jpg）
                    image_ext = base_image["ext"]
                    
                    # 构建图片保存路径
                    image_filename = f"page_{page_num + 1}_img_{img_index + 1}.{image_ext}"
                    image_path = os.path.join(output_dir, image_filename)
                    
                    # 保存图片
                    with open(image_path, "wb") as f:
                        f.write(image_bytes)
                    
                    image_count += 1
                    print(f"已保存: {image_filename}")
        
        print(f"\n提取完成！共提取 {image_count} 张图片，保存至: {os.path.abspath(output_dir)}")
        
    except FileNotFoundError:
        print(f"错误：未找到文件 {pdf_path}")
    except Exception as e:
        print(f"提取过程中出错：{str(e)}")
    finally:
        if 'doc' in locals():
            doc.close()

# 示例调用
if __name__ == "__main__":
    # 替换为你的PDF文件路径
    pdf_file_path = ".\MMRAG_.pdf"
    # 调用函数提取图片
    extract_images_from_pdf(pdf_file_path)
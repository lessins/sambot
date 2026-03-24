import { PluginManager }    from './PluginManager';
import { BrowserPlugin }    from '../tools/BrowserTool';
import { SearchPlugin }     from '../tools/SearchTool';
import { CodePlugin }       from '../tools/CodeTool';
import { ImagePlugin }      from '../tools/ImageTool';
import { FileSystemPlugin } from '../tools/FileSystemTool';

export function registerBuiltins(manager: PluginManager): void {
  manager.register(new BrowserPlugin(),    { description: 'Fetch and read web pages' });
  manager.register(new SearchPlugin(),     { description: 'Search the web via Google or DuckDuckGo' });
  manager.register(new CodePlugin(),       { description: 'Execute code in a sandboxed subprocess' });
  manager.register(new ImagePlugin(),      { description: 'Analyze images from files or URLs' });
  manager.register(new FileSystemPlugin(), { description: 'Read, write, and manage local files' });
}

# k1v4 Kinisi Live Bluetooth Demonstrator

This repo has code for streaming live data from Kinisi gen 1 sleeves (not gen 2).

All code runs in browser.

use simple web server such as :

```python
python -m http.server
```

then navigate to index.html

note URL params can show stats, 
```
http://localhost:8000/?showstats=true  
```

load recorded data :

```
http://localhost:8000/?showstats=true&sim=load  
```
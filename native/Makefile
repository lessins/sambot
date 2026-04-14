CC      = gcc
CFLAGS  = -O2 -Wall -Wextra -fPIC -std=c99
LDFLAGS = -lm

# set to 1 to compile with llama.cpp support
HAVE_LLAMA ?= 0

ifeq ($(HAVE_LLAMA), 1)
  CFLAGS  += -DHAVE_LLAMA_CPP -Illama.cpp
  LDFLAGS += -Lllama.cpp -lllama
endif

TARGET  = libsambot_infer.so
OBJS    = sambot_infer.o

all: $(TARGET)

$(TARGET): $(OBJS)
	$(CC) -shared -o $@ $^ $(LDFLAGS)

sambot_infer.o: sambot_infer.c sambot_infer.h
	$(CC) $(CFLAGS) -c -o $@ $<

clean:
	rm -f $(OBJS) $(TARGET)

.PHONY: all clean

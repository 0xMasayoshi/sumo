cmake_minimum_required(VERSION 3.22)
project(sumo_daemon LANGUAGES CXX)
set(CMAKE_CXX_STANDARD 17)

find_package(OpenSSL REQUIRED)
find_package(Boost REQUIRED COMPONENTS system filesystem)

# vcpkg exports this CMake package:
find_package(LibtorrentRasterbar CONFIG REQUIRED)

# vcpkg port "cpp-httplib" provides this package:
find_package(httplib CONFIG REQUIRED)  # provided by vcpkg port "cpp-httplib"

add_executable(sumo-daemon src/main.cpp)

target_link_libraries(sumo-daemon
  PRIVATE
    LibtorrentRasterbar::torrent-rasterbar           # target exported by the libtorrent package
    OpenSSL::SSL OpenSSL::Crypto
    Boost::system Boost::filesystem
    httplib::httplib
)

# 👇 macOS needs these for cpp-httplib (CFHost* symbols)
if(APPLE)
  find_library(COREFOUNDATION_FRAMEWORK CoreFoundation)
  find_library(CFNETWORK_FRAMEWORK CFNetwork)
  target_link_libraries(sumo-daemon PRIVATE
    ${COREFOUNDATION_FRAMEWORK}
    ${CFNETWORK_FRAMEWORK}
  )
endif()

if (MSVC)
  foreach(flag_var CMAKE_CXX_FLAGS_RELEASE CMAKE_C_FLAGS_RELEASE)
    string(REPLACE "/MD" "/MT" ${flag_var} "${${flag_var}}")
  endforeach()
endif()

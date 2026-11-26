import 'package:dio/dio.dart';

import '../../config/api_config.dart';
import '../../storage/token_storage.dart';

class AuthInterceptor extends QueuedInterceptor {
  final Dio _dio;
  final Dio _refreshDio;
  final TokenStorage _tokenStorage;

  AuthInterceptor({required Dio dio, required this._tokenStorage})
    : _dio = dio,
      _refreshDio = Dio(dio.options);

  bool _isPublicEndpoint(String path) {
    return path == ApiConfig.login ||
        path == ApiConfig.register ||
        path == ApiConfig.refresh;
  }

  @override
  Future<void> onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    try {
      if (!_isPublicEndpoint(options.path)) {
        final accessToken = await _tokenStorage.getAccessToken();

        if (accessToken != null && accessToken.isNotEmpty) {
          options.headers['Authorization'] = 'Bearer $accessToken';
        }
      }

      handler.next(options);
    } catch (error) {
      handler.reject(DioException(requestOptions: options, error: error));
    }
  }

  @override
  Future<void> onError(
    DioException err,
    ErrorInterceptorHandler handler,
  ) async {
    final requestOptions = err.requestOptions;

    // Only attempt refresh for 401 responses.
    if (err.response?.statusCode != 401 ||
        _isPublicEndpoint(requestOptions.path) ||
        requestOptions.extra['retried'] == true) {
      handler.next(err);
      return;
    }

    try {
      final refreshToken = await _tokenStorage.getRefreshToken();

      if (refreshToken == null || refreshToken.isEmpty) {
        await _tokenStorage.clearTokens();
        handler.next(err);
        return;
      }

      // Another queued request may already have refreshed the token.
      final latestAccessToken = await _tokenStorage.getAccessToken();
      final failedAuthorization = requestOptions.headers['Authorization'];

      if (latestAccessToken != null &&
          latestAccessToken.isNotEmpty &&
          failedAuthorization != 'Bearer $latestAccessToken') {
        final response = await _retryRequest(requestOptions, latestAccessToken);
        handler.resolve(response);
        return;
      }

      // Use a separate Dio instance to avoid interceptor recursion.
      final refreshResponse = await _refreshDio.post(
        ApiConfig.refresh,
        data: {'refreshToken': refreshToken},
      );

      final data = refreshResponse.data['data'] as Map<String, dynamic>;
      final tokens = data['tokens'] as Map<String, dynamic>;

      final newAccessToken = tokens['accessToken'] as String;
      final newRefreshToken = tokens['refreshToken'] as String;

      await _tokenStorage.saveTokens(
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      );

      final response = await _retryRequest(requestOptions, newAccessToken);

      handler.resolve(response);
    } catch (error) {
      await _tokenStorage.clearTokens();

      handler.reject(
        DioException(
          requestOptions: requestOptions,
          error: error,
          message: 'Session expired. Please login again.',
        ),
      );
    }
  }

  Future<Response<dynamic>> _retryRequest(
    RequestOptions requestOptions,
    String accessToken,
  ) {
    requestOptions.headers['Authorization'] = 'Bearer $accessToken';
    requestOptions.extra['retried'] = true;

    return _dio.fetch<dynamic>(requestOptions);
  }
}
